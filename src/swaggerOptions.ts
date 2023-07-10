import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YDX-AI-Backend API',
      version: '1.0.0',
    },
    basePath: '/api',
    components: {
      schemas: {
        Users: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
            },
            is_ai: {
              type: 'boolean',
            },
            name: {
              type: 'string',
            },
            user_email: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['user_id', 'is_ai', 'name', 'createdAt', 'updatedAt'],
          additionalProperties: false,
        },
        IAudioClips: {
          type: 'object',
          properties: {
            clip_id: {
              type: 'string',
              format: 'objectid',
            },
            clip_title: {
              type: 'string',
            },
            description_type: {
              type: 'string',
            },
            description_text: {
              type: 'string',
            },
            playback_type: {
              type: 'string',
            },
            clip_start_time: {
              type: 'number',
              format: 'float',
            },
            clip_end_time: {
              type: 'number',
              format: 'float',
            },
            clip_duration: {
              type: 'number',
              format: 'float',
            },
            clip_audio_path: {
              type: 'string',
            },
            is_recorded: {
              type: 'boolean',
            },
            AudioDescriptionAdId: {
              type: 'string',
              format: 'objectid',
            },
          },
          required: [
            'clip_id',
            'clip_title',
            'description_type',
            'description_text',
            'playback_type',
            'clip_start_time',
            'clip_end_time',
            'clip_duration',
            'clip_audio_path',
            'is_recorded',
            'AudioDescriptionAdId',
          ],
          additionalProperties: false,
        },
        IAudioDescriptions: {
          type: 'object',
          properties: {
            ad_id: {
              type: 'string',
              format: 'objectid',
            },
            is_published: {
              type: 'boolean',
            },
            userUserId: {
              type: ['string', 'null'],
              format: 'objectid',
            },
            videoVideoId: {
              type: ['string', 'null'],
              format: 'objectid',
            },
          },
          required: ['ad_id', 'is_published'],
          additionalProperties: false,
        },
        IDialogTimeStamps: {
          type: 'object',
          properties: {
            dialog_id: {
              type: 'string',
              format: 'objectid',
            },
            dialog_sequence_num: {
              type: 'integer',
            },
            dialog_start_time: {
              type: 'number',
              format: 'float',
            },
            dialog_end_time: {
              type: 'number',
              format: 'float',
            },
            dialog_duration: {
              type: 'number',
              format: 'float',
            },
          },
          required: ['dialog_id', 'dialog_sequence_num', 'dialog_start_time', 'dialog_end_time', 'dialog_duration'],
          additionalProperties: false,
        },
        IVideos: {
          type: 'object',
          properties: {
            video_id: {
              type: 'string',
            },
            youtube_video_id: {
              type: 'string',
            },
            video_name: {
              type: 'string',
            },
            video_length: {
              type: 'number',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['video_id', 'youtube_video_id', 'video_name', 'video_length', 'createdAt', 'updatedAt'],
          additionalProperties: false,
        },
        AddTotalTimeDto: {
          type: 'object',
          properties: {
            participant_id: {
              type: 'string',
            },
            time: {
              type: 'number',
            },
            video_id: {
              type: 'string',
            },
          },
          required: ['participant_id', 'time', 'video_id'],
          additionalProperties: false,
        },
        Timings: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
            },
            total_time: {
              type: 'number',
            },
            youtube_video_id: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
            ParticipantParticipantId: {
              type: 'string',
            },
          },
          required: ['id', 'total_time', 'youtube_video_id', 'createdAt', 'updatedAt'],
        },
        CreateUserAudioDescriptionDto: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
            },
            youtubeVideoId: {
              type: 'string',
            },
            aiUserId: {
              type: 'string',
            },
          },
          required: ['userId', 'youtubeVideoId', 'aiUserId'],
          additionalProperties: false,
        },
        CreateUserDto: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
          },
          required: ['email', 'name'],
          additionalProperties: false,
        },
      },
    },
  },
  apis: ['src/**/*.ts'],
};

export default options;
