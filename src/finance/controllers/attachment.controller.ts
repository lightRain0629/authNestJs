import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '@common/src/decorators';
import { JwtPayload } from '../../auth/interfaces';
import { AttachmentService, UploadedAttachmentFile } from '../services';
import { AttachmentResponse } from '../responses';
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
} from '../attachments.constants';

const UPLOAD_BODY = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

const UPLOAD_DESCRIPTION =
  `Multipart, field \`file\`. Max ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB. ` +
  `Allowed: ${ATTACHMENT_EXTENSIONS.join(', ')}. 413 when too large, 415 ` +
  'when the type is not allowed or the content does not match it.';

@ApiTags('finance/attachments')
@ApiBearerAuth('access-token')
@Controller('finance')
@UseInterceptors(ClassSerializerInterceptor)
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('records/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Attach a file to a record',
    description: UPLOAD_DESCRIPTION,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY)
  @ApiCreatedResponse({ type: AttachmentResponse })
  async uploadToRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<AttachmentResponse> {
    const attachment = await this.attachmentService.upload(
      user.id,
      { recordId: id },
      file,
    );
    return new AttachmentResponse(attachment);
  }

  @Get('records/:id/attachments')
  @ApiOperation({ summary: "List a record's attachments" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [AttachmentResponse] })
  async listForRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttachmentResponse[]> {
    const items = await this.attachmentService.list(user.id, { recordId: id });
    return items.map((a) => new AttachmentResponse(a));
  }

  @Post('conversions/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Attach a file to a conversion (transfer)',
    description: UPLOAD_DESCRIPTION,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(UPLOAD_BODY)
  @ApiCreatedResponse({ type: AttachmentResponse })
  async uploadToConversion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<AttachmentResponse> {
    const attachment = await this.attachmentService.upload(
      user.id,
      { conversionId: id },
      file,
    );
    return new AttachmentResponse(attachment);
  }

  @Get('conversions/:id/attachments')
  @ApiOperation({ summary: "List a conversion's attachments" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: [AttachmentResponse] })
  async listForConversion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttachmentResponse[]> {
    const items = await this.attachmentService.list(user.id, {
      conversionId: id,
    });
    return items.map((a) => new AttachmentResponse(a));
  }

  @Get('attachments/:attachmentId/download')
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Streams the file as an attachment under its original name. Needs ' +
      'the Authorization header, so fetch it and save the blob rather than ' +
      'linking to it.',
  })
  @ApiParam({ name: 'attachmentId', format: 'uuid' })
  @ApiOkResponse({ description: 'The file bytes' })
  async download(
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { attachment, stream } = await this.attachmentService.openForDownload(
      attachmentId,
      user.id,
    );

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    return new StreamableFile(stream, {
      type: attachment.mimeType,
      length: attachment.sizeBytes,
      disposition: AttachmentService.contentDisposition(
        attachment.originalName,
      ),
    });
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete an attachment and its file' })
  @ApiParam({ name: 'attachmentId', format: 'uuid' })
  @ApiOkResponse({ type: AttachmentResponse })
  async remove(
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AttachmentResponse> {
    const attachment = await this.attachmentService.remove(
      attachmentId,
      user.id,
    );
    return new AttachmentResponse(attachment);
  }
}
