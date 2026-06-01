import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Patch,
  Delete,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentsService } from '../assignments/assignments.service';
import {
  AssetAttachmentsService,
  MAX_ASSET_ATTACHMENT_SIZE,
} from './asset-attachments.service';
import type { UploadedAssetFile } from './asset-attachments.service';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FindAssetsQueryDto } from './dto/find-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

type AttachmentResponse = {
  set: (headers: Record<string, string | number>) => void;
};

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly assignmentsService: AssignmentsService,
    private readonly assetAttachmentsService: AssetAttachmentsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.TI)
  create(@Body() dto: CreateAssetDto, @Req() req: AuthenticatedRequest) {
    return this.assetsService.create(dto, req.user?.id);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.TI)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  import(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedAssetFile,
    @Body('mapping') mapping?: string,
    @Body('autoGenerateCodes') autoGenerateCodes?: string,
  ) {
    return this.assetsService.importAssets(
      file,
      mapping,
      autoGenerateCodes,
      req.user?.id,
    );
  }

  @Get()
  findAll(@Query() query: FindAssetsQueryDto) {
    return this.assetsService.findAll(query);
  }

  @Get(':id/details')
  details(@Param('id') id: string) {
    return this.assetsService.findDetails(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.assignmentsService.findAssetHistory(id);
  }

  @Get(':id/attachments')
  attachments(@Param('id') id: string) {
    return this.assetAttachmentsService.list(id);
  }

  @Post(':id/attachments')
  @Roles(Role.ADMIN, Role.TI)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ASSET_ATTACHMENT_SIZE },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file?: UploadedAssetFile,
  ) {
    return this.assetAttachmentsService.create(id, file);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: AttachmentResponse,
  ) {
    const { attachment, stream } =
      await this.assetAttachmentsService.getDownload(id, attachmentId);
    const encodedName = encodeURIComponent(attachment.originalName);

    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.size,
      'Content-Disposition': `attachment; filename="${attachment.fileName}"; filename*=UTF-8''${encodedName}`,
    });

    return new StreamableFile(stream);
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(Role.ADMIN, Role.TI)
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.assetAttachmentsService.remove(id, attachmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TI)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.update(id, dto, req.user?.id);
  }
  @Delete(':id')
  @Roles(Role.ADMIN, Role.TI)
  remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('confirmed') confirmed?: string,
    @Query('force') force?: string,
  ) {
    const confirmedDelete =
      confirmed === 'true' ||
      confirmed === '1' ||
      force === 'true' ||
      force === '1';

    return this.assetsService.remove(id, req.user?.id, {
      confirmed: confirmedDelete,
    });
  }
}
