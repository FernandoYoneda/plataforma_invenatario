import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export type UploadedAssetFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
};

export const MAX_ASSET_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const UPLOAD_ROOT = 'uploads';
const ASSET_UPLOAD_DIR = join(UPLOAD_ROOT, 'assets');
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class AssetAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(assetId: string) {
    await this.ensureAssetExists(assetId);

    return this.prisma.assetAttachment.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(assetId: string, file?: UploadedAssetFile) {
    await this.ensureAssetExists(assetId);
    this.validateFile(file);

    const uploadDir = resolve(process.cwd(), ASSET_UPLOAD_DIR);
    await mkdir(uploadDir, { recursive: true });

    const extension = extname(file.originalname).toLowerCase();
    const fileName = `${assetId}-${Date.now()}-${randomUUID()}${extension}`;
    const filePath = join(ASSET_UPLOAD_DIR, fileName).replace(/\\/g, '/');
    const absolutePath = resolve(process.cwd(), filePath);

    await writeFile(absolutePath, file.buffer as Buffer);

    return this.prisma.assetAttachment.create({
      data: {
        assetId,
        fileName,
        originalName: basename(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        filePath,
      },
    });
  }

  async remove(assetId: string, attachmentId: string) {
    const attachment = await this.findAttachment(assetId, attachmentId);

    await this.prisma.assetAttachment.delete({
      where: { id: attachment.id },
    });

    try {
      await unlink(this.resolveStoredPath(attachment.filePath));
    } catch {
      // O registro ja foi removido; arquivo ausente nao deve bloquear a exclusao.
    }

    return { ok: true };
  }

  async getDownload(assetId: string, attachmentId: string) {
    const attachment = await this.findAttachment(assetId, attachmentId);
    const absolutePath = this.resolveStoredPath(attachment.filePath);

    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Arquivo do anexo nao encontrado');
    }

    return {
      attachment,
      stream: createReadStream(absolutePath),
    };
  }

  private async ensureAssetExists(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!asset) {
      throw new NotFoundException('Ativo nao encontrado');
    }
  }

  private validateFile(file?: UploadedAssetFile): asserts file is UploadedAssetFile & {
    buffer: Buffer;
  } {
    if (!file?.buffer) {
      throw new BadRequestException('Arquivo e obrigatorio');
    }

    if (file.size <= 0) {
      throw new BadRequestException('Arquivo vazio nao e permitido');
    }

    if (file.size > MAX_ASSET_ATTACHMENT_SIZE) {
      throw new BadRequestException('Arquivo excede o limite de 10MB');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo nao permitido');
    }
  }

  private async findAttachment(assetId: string, attachmentId: string) {
    const attachment = await this.prisma.assetAttachment.findFirst({
      where: {
        id: attachmentId,
        assetId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Anexo nao encontrado');
    }

    return attachment;
  }

  private resolveStoredPath(filePath: string) {
    const uploadRoot = resolve(process.cwd(), UPLOAD_ROOT);
    const absolutePath = resolve(process.cwd(), filePath);

    if (absolutePath !== uploadRoot && !absolutePath.startsWith(uploadRoot + sep)) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }

    return absolutePath;
  }
}
