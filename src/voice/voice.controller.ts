import {
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { VoiceService } from './voice.service';

interface VapiWebhookBody {
  message: {
    type: string;
    toolCallList?: Array<{
      id: string;
      function: { name: string; arguments: Record<string, unknown> };
    }>;
    [key: string]: unknown;
  };
}

/**
 * Single webhook Vapi posts every server-side event to during a call. We only act on two message
 * types: "tool-calls" (the assistant asking us to read/write patient data) and
 * "end-of-call-report" (the final transcript, logged for observability).
 */
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('webhook')
  async webhook(
    @Body() body: VapiWebhookBody,
    @Headers('x-vapi-secret') secret?: string,
  ) {
    // Fail closed: an unset VAPI_SERVER_SECRET must not silently turn this into a public
    // endpoint that anyone can write patient records through.
    const expectedSecret = process.env.VAPI_SERVER_SECRET;
    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'VAPI_SERVER_SECRET is not configured; refusing webhook requests',
      );
    }
    if (secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const { message } = body;

    if (message?.type === 'tool-calls' && message.toolCallList) {
      const results = await Promise.all(
        message.toolCallList.map(async (toolCall) => ({
          toolCallId: toolCall.id,
          result: JSON.stringify(
            await this.voiceService.handleToolCall(toolCall),
          ),
        })),
      );
      return { results };
    }

    if (message?.type === 'end-of-call-report') {
      this.voiceService.logEndOfCall(message);
    }

    return { received: true };
  }
}
