import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import { FileFormRequest } from '../modules/files/fileFormRequest';
import * as fileStorageService from '../modules/files/fileStorageService';
import { domainError } from '../modules/shared/domainError';

const router = Router();

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    const data = await action;
    res.status(successStatus).json(data);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

router.use(authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'));

function parseOptionalMetadata(value: string | undefined) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw domainError.badRequest('metadata phải là JSON hợp lệ.');
  }
}

function parseMultipartUpload(req: Request) {
  return new Promise<ReturnType<typeof FileFormRequest.parseUpload>>((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      reject(domainError.badRequest('Upload file phải dùng multipart/form-data.'));
      return;
    }

    const fields: Record<string, string> = {};
    let fileSeen = false;
    let fileLimited = false;
    let filePromise: Promise<{
      tempFilePath: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      checksumSha256: string;
    }> | null = null;

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 20,
        fileSize: fileStorageService.getMaxUploadBytes(),
      },
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      if (name !== 'file') {
        file.resume();
        return;
      }
      if (fileSeen) {
        file.resume();
        reject(domainError.badRequest('Mỗi request chỉ được upload một file.'));
        return;
      }
      fileSeen = true;

      const tempFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.upload`;
      const tempFilePath = path.join(fileStorageService.getTmpDirectory(), tempFileName);
      const writeStream = fs.createWriteStream(tempFilePath, { flags: 'wx' });
      const hash = crypto.createHash('sha256');
      let sizeBytes = 0;

      file.on('data', (chunk: Buffer) => {
        sizeBytes += chunk.length;
        hash.update(chunk);
      });
      file.on('limit', () => {
        fileLimited = true;
      });

      file.pipe(writeStream);
      filePromise = new Promise((fileResolve, fileReject) => {
        file.on('error', fileReject);
        writeStream.on('error', fileReject);
        writeStream.on('finish', () => {
          fileResolve({
            tempFilePath,
            originalName: info.filename || fields.originalName || 'file',
            mimeType: info.mimeType || 'application/octet-stream',
            sizeBytes,
            checksumSha256: hash.digest('hex'),
          });
        });
      });
    });

    busboy.on('filesLimit', () => {
      reject(domainError.badRequest('Mỗi request chỉ được upload một file.'));
    });
    busboy.on('fieldsLimit', () => {
      reject(domainError.badRequest('Upload có quá nhiều field.'));
    });
    busboy.on('error', reject);
    busboy.on('finish', async () => {
      try {
        if (!filePromise) throw domainError.badRequest('Thiếu file upload.');
        const file = await filePromise;
        if (fileLimited) {
          await fs.promises.unlink(file.tempFilePath).catch(() => {});
          throw domainError.badRequest(`File quá lớn. Giới hạn hiện tại là ${Math.floor(fileStorageService.getMaxUploadBytes() / 1024 / 1024)}MB.`);
        }
        resolve(FileFormRequest.parseUpload({
          ...fields,
          metadata: parseOptionalMetadata(fields.metadata),
          ...file,
          originalName: fields.originalName || file.originalName,
        }));
      } catch (error) {
        reject(error);
      }
    });

    req.pipe(busboy);
  });
}

router.post('/upload', asyncHandler(async (req, res) => {
  const body = await parseMultipartUpload(req);
  try {
    await respond(res, fileStorageService.uploadFile(body, req.user), 201);
  } catch (error) {
    await fs.promises.unlink(body.tempFilePath).catch(() => {});
    throw error;
  }
}));

export default router;
