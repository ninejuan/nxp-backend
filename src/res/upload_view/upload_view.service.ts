import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { Response as Res } from 'express';
import { extname } from 'path';
import * as mime from 'mime-types';

@Injectable()
export class UploadViewService {
    getFile(filePath: string, res: Res): StreamableFile {
        const file = createReadStream(filePath);
        const mimeType = mime.lookup(extname(filePath)) || 'application/octet-stream';

        res.set({
            'Content-Type': mimeType, // 동적으로 MIME 타입 설정
            'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
        });
        return new StreamableFile(file);
    }
}
