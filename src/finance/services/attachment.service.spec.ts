import { AttachmentService } from './attachment.service';
import { RecordService } from './record.service';
import { ConversionService } from './conversion.service';

describe('AttachmentService', () => {
  describe('cleanFileName', () => {
    it('repairs a UTF-8 name that multer decoded as latin1', () => {
      const mangled = Buffer.from('отчёт.xlsx', 'utf8').toString('latin1');
      expect(AttachmentService.cleanFileName(mangled)).toBe('отчёт.xlsx');
    });

    it('leaves a plain latin1 name alone', () => {
      expect(AttachmentService.cleanFileName('café.csv')).toBe('café.csv');
    });

    it('drops any path and control characters', () => {
      expect(
        AttachmentService.cleanFileName('../../etc/pa\nss\u0000wd.txt'),
      ).toBe('passwd.txt');
      expect(AttachmentService.cleanFileName('C:\\Users\\me\\a.pdf')).toBe(
        'a.pdf',
      );
    });

    it('caps the length but keeps the extension', () => {
      const name = AttachmentService.cleanFileName('a'.repeat(400) + '.xlsx');
      expect(name).toHaveLength(255);
      expect(name.endsWith('.xlsx')).toBe(true);
    });
  });

  describe('contentDisposition', () => {
    it('cannot be broken out of with quotes or new lines', () => {
      const header = AttachmentService.contentDisposition('a"b\\c.pdf');
      expect(header).toBe(
        `attachment; filename="a_b_c.pdf"; filename*=UTF-8''a%22b%5Cc.pdf`,
      );
    });
  });
});

describe('deleting an entry removes its files', () => {
  const attachmentService = {
    storageKeysFor: jest.fn().mockResolvedValue(['k1', 'k2']),
    discardFiles: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  it('for a record, after the row is gone', async () => {
    const order: string[] = [];
    const prisma = {
      financeRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1' }),
        delete: jest.fn(async () => {
          order.push('delete');
          return { id: 'r1' };
        }),
      },
    };
    attachmentService.discardFiles.mockImplementation(async () => {
      order.push('discard');
    });
    const service = new RecordService(
      prisma as any,
      {} as any,
      {} as any,
      attachmentService as any,
    );

    await service.remove('r1', 'u1');

    expect(attachmentService.storageKeysFor).toHaveBeenCalledWith({
      recordId: 'r1',
    });
    expect(attachmentService.discardFiles).toHaveBeenCalledWith(['k1', 'k2']);
    expect(order).toEqual(['delete', 'discard']);
  });

  it('for a conversion', async () => {
    const prisma = {
      currencyConversion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', userId: 'u1' }),
        delete: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
    };
    const service = new ConversionService(
      prisma as any,
      {} as any,
      {} as any,
      attachmentService as any,
    );

    await service.remove('c1', 'u1');

    expect(attachmentService.storageKeysFor).toHaveBeenCalledWith({
      conversionId: 'c1',
    });
    expect(attachmentService.discardFiles).toHaveBeenCalledWith(['k1', 'k2']);
  });

  it('keeps the files when the entry is not yours', async () => {
    const prisma = {
      financeRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new RecordService(
      prisma as any,
      {} as any,
      {} as any,
      attachmentService as any,
    );

    await expect(service.remove('r1', 'other')).rejects.toThrow(
      'Record not found',
    );
    expect(attachmentService.discardFiles).not.toHaveBeenCalled();
  });
});
