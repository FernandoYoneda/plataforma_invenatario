import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetStatus, AssetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from './assets.service';

describe('AssetsService', () => {
  let service: AssetsService;

  const prismaMock = {
    $transaction: jest.fn(),
    asset: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  it('creates typed assets with normalized fields', async () => {
    prismaMock.$transaction.mockResolvedValue('TI-000123');
    prismaMock.asset.create.mockResolvedValue({ id: 'asset-1' });

    await service.create({
      type: AssetType.NOTEBOOK,
      brand: ' Dell ',
      model: ' Latitude 5400 ',
      serialNumber: '  ABC123  ',
      valueCents: 450000,
      status: AssetStatus.ESTOQUE,
      notes: '  pronto para uso  ',
    });

    expect(prismaMock.asset.create).toHaveBeenCalledWith({
      data: {
        internalCode: 'TI-000123',
        type: AssetType.NOTEBOOK,
        brand: 'Dell',
        model: 'Latitude 5400',
        serialNumber: 'ABC123',
        valueCents: 450000,
        status: AssetStatus.ESTOQUE,
        notes: 'pronto para uso',
      },
    });
  });

  it('rejects typed assets without valueCents', async () => {
    await expect(
      service.create({
        type: AssetType.DESKTOP,
        brand: 'Lenovo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when asset does not exist', async () => {
    prismaMock.asset.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('searches with normalized filters and brand inside free text query', async () => {
    prismaMock.asset.findMany.mockResolvedValue([]);

    await service.findAll({
      type: AssetType.MONITOR,
      status: AssetStatus.EM_USO,
      brand: '  Dell ',
      q: '  latitude ',
    });

    expect(prismaMock.asset.findMany).toHaveBeenCalledWith({
      where: {
        type: AssetType.MONITOR,
        status: AssetStatus.EM_USO,
        brand: { contains: 'Dell', mode: 'insensitive' },
        OR: [
          { internalCode: { contains: 'latitude', mode: 'insensitive' } },
          { brand: { contains: 'latitude', mode: 'insensitive' } },
          { model: { contains: 'latitude', mode: 'insensitive' } },
          { serialNumber: { contains: 'latitude', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('rejects update when resulting typed asset has no value', async () => {
    prismaMock.asset.findUnique.mockResolvedValue({
      id: 'asset-1',
      type: AssetType.MOUSE,
      valueCents: null,
      brand: 'Logitech',
    });

    await expect(
      service.update('asset-1', {
        type: AssetType.DESKTOP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
