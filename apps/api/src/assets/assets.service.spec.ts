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
        purchaseDate: null,
        phoneNumber1: null,
        phoneNumber2: null,
        imei1: null,
        imei2: null,
        carrier: null,
        status: AssetStatus.ESTOQUE,
        notes: 'pronto para uso',
        categoryId: undefined,
        locationId: undefined,
      },
    });
  });

  it('creates smartphone assets with normalized optional corporate fields', async () => {
    prismaMock.$transaction.mockResolvedValue('TI-000124');
    prismaMock.asset.create.mockResolvedValue({ id: 'asset-2' });

    await service.create({
      type: AssetType.SMARTPHONE,
      brand: ' Samsung ',
      model: ' Galaxy S24 ',
      purchaseDate: '2026-05-21',
      phoneNumber1: ' (11) 99999-9999 ',
      phoneNumber2: '',
      imei1: '123 456 789 012 345',
      imei2: null,
      carrier: ' Vivo ',
      status: AssetStatus.ESTOQUE,
    });

    expect(prismaMock.asset.create).toHaveBeenCalledWith({
      data: {
        internalCode: 'TI-000124',
        type: AssetType.SMARTPHONE,
        brand: 'Samsung',
        model: 'Galaxy S24',
        serialNumber: null,
        valueCents: undefined,
        purchaseDate: new Date(Date.UTC(2026, 4, 21, 12)),
        phoneNumber1: '(11) 99999-9999',
        phoneNumber2: null,
        imei1: '123456789012345',
        imei2: null,
        carrier: 'Vivo',
        status: AssetStatus.ESTOQUE,
        notes: null,
        categoryId: undefined,
        locationId: undefined,
      },
    });
  });

  it('rejects smartphone assets with invalid IMEI', async () => {
    await expect(
      service.create({
        type: AssetType.SMARTPHONE,
        brand: 'Apple',
        imei1: '123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid purchaseDate values', async () => {
    await expect(
      service.create({
        type: AssetType.SMARTPHONE,
        brand: 'Samsung',
        purchaseDate: '31/02/2026',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      include: {
        category: true,
        location: true,
      },
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
