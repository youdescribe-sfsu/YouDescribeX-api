import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs';
import getMP3Duration from 'get-mp3-duration';
import mime from 'mime-types';
import { ClientSession } from 'mongoose';
import multer from 'multer'; // to process form-data
import { Op } from 'sequelize';
import util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { AUDIO_DIRECTORY, CURRENT_DATABASE } from '../config';
import { IAudioClip } from '../models/mongodb/AudioClips.mongo';
import { MongoAudioClipsModel, MongoDialog_Timestamps_Model } from '../models/mongodb/init-models.mongo';
import { Audio_Clips, Dialog_Timestamps, Videos } from '../models/postgres/init-models';
import { logger } from '../utils/logger';
import { getYouTubeVideoStatus, nowUtc } from '../utils/util';

interface NudgeStartTimeIfZeroResult {
  data: [] | null;
  message: string;
}

function isIAudioClip(clip: IAudioClip | Audio_Clips): clip is IAudioClip {
  return (clip as IAudioClip).start_time !== undefined;
}

function isAudioClips(clip: IAudioClip | Audio_Clips): clip is Audio_Clips {
  return (clip as Audio_Clips).clip_start_time !== undefined;
}

export const nudgeStartTimeIfZero = async (audioClips: Audio_Clips[] | IAudioClip[]): Promise<NudgeStartTimeIfZeroResult> => {
  const startTimeZeroaudioClipIds: string[] = [];

  for (const clip of audioClips) {
    if (isAudioClips(clip)) {
      if (clip.clip_start_time === 0) {
        startTimeZeroaudioClipIds.push(clip.clip_id);
      }
    } else if (isIAudioClip(clip)) {
      if (clip.start_time === 0) {
        startTimeZeroaudioClipIds.push(clip._id);
      }
    }
  }

  if (startTimeZeroaudioClipIds.length === 0) {
    return {
      data: [],
      message: 'None of the clips are starting at 0sec. Success OK!',
    };
  }

  try {
    if (CURRENT_DATABASE == 'mongodb') {
      const clipsToUpdate = await MongoAudioClipsModel.find({
        clip_id: { $in: startTimeZeroaudioClipIds },
      });

      await Promise.all(clipsToUpdate.map(async clip => await clip.update({ start_time: clip.start_time + 1 })));
      return {
        data: [],
        message: 'Clip Start Times Updated. Success OK!',
      };
    } else {
      const clipsToUpdate = await Audio_Clips.findAll({
        where: {
          clip_id: startTimeZeroaudioClipIds,
        },
        logging: false,
        // raw: true, // for getting just data and no db info
      });

      await Promise.all(
        clipsToUpdate.map(async clip => {
          await clip.update({ clip_start_time: clip.clip_start_time + 1 });
        }),
      );

      return {
        data: [],
        message: 'Clip Start Times Updated. Success OK!',
      };
    }
  } catch (err) {
    return {
      data: null,
      message: `Error nudging Clip Start Times. Please check again.. ${err}`,
    };
  }
};

interface GenerateMp3forDescriptionTextResponse {
  status: boolean;
  filepath: string | null;
  filename: string | null;
  file_mime_type: string | null;
  file_size_bytes: number;
}

export const generateMp3forDescriptionText = async (
  adId: string,
  youtubeVideoId: string,
  clipDescriptionText: string,
  clipDescriptionType: string,
): Promise<GenerateMp3forDescriptionTextResponse> => {
  try {
    const client = new textToSpeech.TextToSpeechClient();

    // generate a unique ID
    const uniqueId = uuidv4();
    // assign female/male voice types based on description type
    // OCR => Female, NON OCR => Male
    const voiceName =
      clipDescriptionType === 'Visual'
        ? 'en-US-Wavenet-D' // Male
        : 'en-US-Wavenet-C'; // Female

    // Construct the request
    const request: any = {
      input: { text: clipDescriptionText },
      // Select the language and SSML voice gender (optional)
      voice: {
        languageCode: 'en-US',
        name: voiceName,
        ssmlGender: 'NEUTRAL',
      },
      // select the type of audio encoding
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.25 },
    };
    // Performs the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);

    // add a folder for video ID and a sub folder for user ID

    const dir = `${AUDIO_DIRECTORY}/audio/${youtubeVideoId}/${adId}`;
    logger.info(`dir: ${dir}`);
    // creates the folder structure if it doesn't exist -- ${youtubeVideoId}/${adId}
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // write the audio file only if the directory exists/created
    if (fs.existsSync(dir)) {
      // store a variable ocr to add to the path of the audio file
      const type = clipDescriptionType === 'Visual' ? 'nonOCR' : 'OCR';
      const fileName = `${type}-${uniqueId}.mp3`;
      const filepath = `${dir}/${fileName}`;
      // Write the binary audio content to a local file
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(filepath, response.audioContent, 'binary');

      const fileMimeType = mime.lookup(filepath);
      const fileSizeBytes = fs.statSync(filepath).size;
      // remove public from the file path
      const servingFilepath = `./audio/${youtubeVideoId}/${adId}`;
      logger.info(`Converted Text to Speech:Serving file path ${servingFilepath}`);
      return {
        status: true,
        filepath: servingFilepath,
        filename: fileName,
        file_mime_type: fileMimeType ? fileMimeType : 'audio/mpeg',
        file_size_bytes: fileSizeBytes,
      };
    }
    return { status: false, filepath: null, filename: null, file_mime_type: null, file_size_bytes: -1 };
  } catch (error) {
    logger.info(error);
    return { status: false, filepath: null, filename: null, file_mime_type: null, file_size_bytes: -1 };
  }
};

interface AnalyzePlaybackTypeResponse {
  message: string;
  data: 'extended' | 'inline' | null;
}

// analyze clip playback type from dialog timestamp data
export const analyzePlaybackType = async (
  currentClipStartTime: number,
  currentClipEndTime: number,
  videoId: string,
  adId: string,
  clipId: string | null,
  processingAllClips: boolean,
): Promise<AnalyzePlaybackTypeResponse> => {
  if (CURRENT_DATABASE == 'mongodb') {
    try {
      console.log('currentClipStartTime', currentClipStartTime);
      console.log('currentClipEndTime', currentClipEndTime);
      console.log('videoId', videoId);
      console.log('adId', adId);
      console.log('clipId', clipId);

      const overlappingDialogs = await MongoDialog_Timestamps_Model.find({
        video: videoId,
        $and: [{ dialog_start_time: { $lte: currentClipEndTime } }, { dialog_end_time: { $gte: currentClipStartTime } }],
      }).select('dialog_start_time dialog_end_time');
      console.log('overlappingDialogs', overlappingDialogs.length);
      if (overlappingDialogs.length !== 0) {
        return {
          message: 'Success - extended!',
          data: 'extended',
        };
      }

      const overlappingClips = await MongoAudioClipsModel.find({
        audio_description: adId,
        $and: [
          { clip_start_time: { $lte: currentClipEndTime } },
          { clip_end_time: { $gte: currentClipStartTime } },
          { clip_id: { $ne: clipId === null ? null : clipId } },
        ],
      });
      console.log('overlappingClips', overlappingClips.length);
      if (overlappingClips.length === 0) {
        return {
          message: 'Success - inline!',
          data: 'inline',
        };
      }
      if (processingAllClips) {
        let countOfClipsAfter = 0;
        overlappingClips.forEach(clip => {
          if (clip.start_time > currentClipStartTime) {
            countOfClipsAfter++;
          }
        });

        if (countOfClipsAfter > 0) {
          return {
            message: 'Success - extended!',
            data: 'extended',
          };
        } else {
          return {
            message: 'Success - inline!',
            data: 'inline',
          };
        }
      } else {
        if (clipId === null) {
          return {
            message: 'Success - extended!',
            data: 'extended',
          };
        }
        const playbackType = (await MongoAudioClipsModel.findById(clipId)).toJSON()['playback_type'];
        return {
          message: `Success - ${playbackType}!`,
          data: playbackType,
        };
      }
    } catch (error) {
      // Handle any errors here
      console.error(error);
    }
  } else {
    try {
      const overlappingDialogs = await Dialog_Timestamps.findAll({
        where: {
          VideoVideoId: videoId,
          [Op.and]: [
            {
              dialog_start_time: {
                [Op.lte]: currentClipEndTime,
              },
            },
            {
              dialog_end_time: {
                [Op.gte]: currentClipStartTime,
              },
            },
          ],
        },
        attributes: ['dialog_start_time', 'dialog_end_time'],
      });
      if (overlappingDialogs.length !== 0) {
        return {
          message: 'Success - extended!',
          data: 'extended',
        };
      }

      const overlappingClips = await Audio_Clips.findAll({
        where: {
          AudioDescriptionAdId: adId,
          [Op.and]: [
            {
              clip_start_time: {
                [Op.lte]: currentClipEndTime,
              },
            },
            {
              clip_end_time: {
                [Op.gte]: currentClipStartTime,
              },
            },
            {
              clip_id: {
                [Op.not]: clipId === null ? null : [clipId],
              },
            },
          ],
        },
        raw: true,
      });

      if (overlappingClips.length === 0) {
        return {
          message: 'Success - inline!',
          data: 'inline',
        };
      }

      if (processingAllClips) {
        let countOfClipsAfter = 0;
        overlappingClips.forEach(clip => {
          if (clip.clip_start_time > currentClipStartTime) {
            countOfClipsAfter++;
          }
        });

        if (countOfClipsAfter > 0) {
          return {
            message: 'Success - extended!',
            data: 'extended',
          };
        } else {
          return {
            message: 'Success - inline!',
            data: 'inline',
          };
        }
      } else {
        return {
          message: 'Success - extended!',
          data: 'extended',
        };
      }
    } catch (err) {
      logger.info(err);
      return {
        message: 'Unable to connect to DB - Analyze Playback Type!! Please try again',
        data: null,
      };
    }
  }
};

export const deleteOldAudioFile = async (old_audio_path: string) => {
  const newPath = AUDIO_DIRECTORY + old_audio_path.replace('.', '');
  // const newPath = path.join(__dirname, '../../', old_audio_path.replace('.', 'public'));
  logger.info(`Old Audio File Path: ${old_audio_path}`);
  logger.info(`new Path: ${newPath}`);

  try {
    fs.unlinkSync(newPath);
    logger.info('Old Audio File Deleted');
    return true;
  } catch (err) {
    logger.error(err);
    return false;
  }
};

export const getClipStartTimebyId = async (clipId: string) => {
  if (CURRENT_DATABASE === 'mongodb') {
    return MongoAudioClipsModel.findById(clipId)
      .then(clip => {
        return {
          message: 'Success',
          data: clip.start_time.toFixed(2),
        };
      })
      .catch(err => {
        return {
          message: `Unable to connect to DB - getClipStartTimebyId!! Please try again ${err}`,
          data: null,
        }; // send error message
      });
  } else {
    return Audio_Clips.findOne({
      where: {
        clip_id: clipId,
      },
      attributes: ['clip_start_time'],
    })
      .then(clip => {
        return {
          message: 'Success',
          data: clip.clip_start_time.toFixed(2),
        };
      })
      .catch(err => {
        return {
          message: `Unable to connect to DB - getClipStartTimebyId!! Please try again ${err}`,
          data: null,
        }; // send error message
      });
  }
};

export const getOldAudioFilePath = async (clipId: string) => {
  if (CURRENT_DATABASE === 'mongodb') {
    return MongoAudioClipsModel.findById(clipId)
      .then(clip => {
        return {
          message: 'Success',
          data: clip.file_name ? clip.file_path + '/' + clip.file_name : clip.file_path,
        };
      })
      .catch(err => {
        return {
          message: `Unable to connect to DB - getOldAudioFilePath!! Please try again ${err}`,
          data: null,
        }; // send error message
      });
  } else {
    return Audio_Clips.findOne({
      where: {
        clip_id: clipId,
      },
      attributes: ['clip_audio_path'],
    })
      .then(clip => {
        return {
          message: 'Success',
          data: clip.clip_audio_path,
        };
      })
      .catch(err => {
        return {
          message: `Unable to connect to DB - getOldAudioFilePath!! Please try again ${err}`,
          data: null,
        }; // send error message
      });
  }
};

export const getVideoFromYoutubeId = async youtubeVideoID => {
  if (CURRENT_DATABASE === 'mongodb') {
    return getYouTubeVideoStatus(youtubeVideoID)
      .then(video => {
        return { message: 'Success', data: video._id };
      })
      .catch(err => {
        return {
          message: 'Error Connecting to DB!! Please try again. getVideoFromYoutubeId ' + err,
          data: null,
        };
      });
  } else {
    return Videos.findOne({
      where: {
        youtube_video_id: youtubeVideoID,
      },
    })
      .then(video => {
        return { message: 'Success', data: video.video_id };
      })
      .catch(err => {
        return {
          message: 'Error Connecting to DB!! Please try again. getVideoFromYoutubeId ' + err,
          data: null,
        };
      });
  }
};

export const updatePlaybackinDB = async (clipId: string, playbackType: any) => {
  if (CURRENT_DATABASE === 'mongodb') {
    return MongoAudioClipsModel.updateOne(
      {
        _id: clipId,
      },
      {
        playback_type: playbackType,
      },
    )
      .then(async clip => {
        return {
          message: 'Updated Playback Type',
          data: clip,
        };
      })
      .catch(err => {
        return {
          message: 'Error in Updating Playback Type' + err,
          data: null,
        };
      });
  } else {
    return Audio_Clips.update(
      {
        playback_type: playbackType,
      },
      {
        where: {
          clip_id: clipId,
        },
      },
    )
      .then(async clip => {
        return {
          message: 'Updated Playback Type',
          data: clip,
        };
      })
      .catch(err => {
        return {
          message: 'Error in Updating Playback Type' + err,
          data: null,
        };
      });
  }
};

export const processCurrentClip = async data => {
  // check if there is an error in text to speech generation
  if (!data.textToSpeechOutput.status) {
    return {
      clip_id: data.clip_id,
      message: 'Unable to generate Text to Speech!! Please try again',
    };
  }
  // text to speech generation is successful
  else {
    // calculate audio duration
    logger.info('Generating Audio Duration');
    const clipPath =
      data.textToSpeechOutput.filename == null || data.textToSpeechOutput.filename.length <= 0
        ? data.textToSpeechOutput.filepath
        : data.textToSpeechOutput.filepath + '/' + data.textToSpeechOutput.filename;
    const clipDurationStatus = await getAudioDuration(clipPath);
    // check if the returned data is null - an error in generating Audio Duration
    if (clipDurationStatus.data === null) {
      return {
        clip_id: data.clip_id,
        message: clipDurationStatus.message,
      };
    } else {
      // Audio Duration generation successful
      const clipDuration = clipDurationStatus.data;

      // fetch the updated nudged start time - done by nudgeStartTimeIfZero()
      const getClipStartTimeStatus = await getClipStartTimebyId(data.clip_id);
      // check if the returned data is null - an error in analyzing Playback type
      if (getClipStartTimeStatus.data === null) {
        return {
          clip_id: data.clip_id,
          message: getClipStartTimeStatus.message,
        };
      } else {
        const clipStartTime = parseFloat(getClipStartTimeStatus.data).toFixed(2);
        const clipEndTime = Number((parseFloat(clipStartTime) + parseFloat(clipDuration)).toFixed(2));

        if (CURRENT_DATABASE === 'mongodb') {
          return MongoAudioClipsModel.updateOne(
            {
              _id: data.clip_id,
            },
            {
              start_time: Number(parseFloat(clipStartTime).toFixed(2)), // rounding the start time
              file_path: data.textToSpeechOutput.filepath,
              duration: parseFloat(clipDuration),
              end_time: clipEndTime,
              file_name: data.textToSpeechOutput.filename,
              file_mime_type: data.textToSpeechOutput.file_mime_type,
              file_size_bytes: data.textToSpeechOutput.file_size_bytes,
            },
          )
            .then(async () => {
              // analyze clip playback type from dialog timestamp & Audio Clips data
              logger.info('Analyzing clip playback type from dialog timestamp & Audio Clips data');
              const analysisStatus = await analyzePlaybackType(
                Number(clipStartTime),
                clipEndTime,
                data.video_id,
                data.ad_id,
                data.clip_id,
                true, // passing true as this is processing all audio clips at once
              );
              // check if the returned data is null - an error in analyzing Playback type
              if (analysisStatus.data === null) {
                return {
                  clip_id: data.clip_id,
                  message: analysisStatus.message,
                };
              } else {
                const playbackType = analysisStatus.data;

                const updatePlaybackStatus = await updatePlaybackinDB(data.clip_id, playbackType);
                // check if the returned data is null - an error in updatingPlayback type
                if (updatePlaybackStatus.data === null) {
                  return {
                    clip_id: data.clip_id,
                    message: updatePlaybackStatus.message,
                  };
                } else {
                  return {
                    clip_id: data.clip_id,
                    message: 'Success OK',
                    playbackType: playbackType,
                  };
                }
              }
            })
            .catch(err => {
              logger.info(err);
              return {
                clip_id: data.clip_id,
                message: 'Unable to Update DB !! Please try again' + err,
              };
              // return the error msg with the clip_id
            });
        } else {
          // update the path of the audio file, duration, end time, start time of the audio clip in the db
          return await Audio_Clips.update(
            {
              clip_start_time: Number(parseFloat(clipStartTime).toFixed(2)), // rounding the start time
              clip_audio_path: data.textToSpeechOutput.filepath,
              clip_duration: parseFloat(clipDuration),
              clip_end_time: clipEndTime,
            },
            {
              where: {
                clip_id: data.clip_id,
              },
              // logging: false,
            },
          )
            .then(async () => {
              // analyze clip playback type from dialog timestamp & Audio Clips data
              logger.info('Analyzing clip playback type from dialog timestamp & Audio Clips data');
              const analysisStatus = await analyzePlaybackType(
                Number(clipStartTime),
                clipEndTime,
                data.video_id,
                data.ad_id,
                data.clip_id,
                true, // passing true as this is processing all audio clips at once
              );
              // check if the returned data is null - an error in analyzing Playback type
              if (analysisStatus.data === null) {
                return {
                  clip_id: data.clip_id,
                  message: analysisStatus.message,
                };
              } else {
                const playbackType = analysisStatus.data;

                const updatePlaybackStatus = await updatePlaybackinDB(data.clip_id, playbackType);
                // check if the returned data is null - an error in updatingPlayback type
                if (updatePlaybackStatus.data === null) {
                  return {
                    clip_id: data.clip_id,
                    message: updatePlaybackStatus.message,
                  };
                } else {
                  return {
                    clip_id: data.clip_id,
                    message: 'Success OK',
                    playbackType: playbackType,
                  };
                }
              }
            })
            .catch(err => {
              logger.info(err);
              return {
                clip_id: data.clip_id,
                message: 'Unable to Update DB !! Please try again' + err,
              };
              // return the error msg with the clip_id
            });
        }
      }
    }
  }
};

export const getAudioDuration = async (filepath: string) => {
  const newPath = AUDIO_DIRECTORY + filepath.replace('.', '');
  // const newPath = path.join(__dirname, '../../', filepath.replace('.', './public'));
  logger.info(`new path: ${newPath}`);

  try {
    const buffer = fs.readFileSync(newPath);
    const duration = (getMP3Duration(buffer) / 1000).toFixed(2);
    return {
      message: 'Success',
      data: duration,
    };
  } catch (err) {
    logger.error(err);
    return {
      message: 'Error in Getting Audio Duration!! Please try again',
      data: null,
    };
  }
};

const storage = multer.diskStorage({
  filename: function (req, _file, cb) {
    const uniqueId = uuidv4();
    const newACType = req.body.newACType === 'Visual' ? 'nonOCR' : 'OCR';
    cb(null, `${newACType}-${uniqueId}.mp3`);
  },
  destination: function (req, _file, cb) {
    const audioDescriptionId = req.params.adId || req.body.audioDescriptionId;
    const dir = `${AUDIO_DIRECTORY}/audio/${req.body.youtubeVideoId}/${audioDescriptionId}`;
    // const dir = path.join(__dirname, '../../', `.${AUDIO_DIRECTORY}/${req.body.youtubeVideoId}/${req.body.userId}`);
    cb(null, dir);
  },
  // onError:(err, next) => {
  //     logger.info('error', err);
  //     next(err);
  // } ,
});
export const upload = multer({ storage });

const copyAudioClipFile = (oldPath: string, youtubeVideoId: string, fileName: string, adId: string) => {
  // old path = oldPath + / + fileName
  const oldAbsPath = `${AUDIO_DIRECTORY}${oldPath.replace('.', '')}/${fileName}`;
  if (!fs.existsSync(oldAbsPath)) {
    logger.error(oldAbsPath + `does not exist`);
    return oldPath;
  }
  const newPath = `${AUDIO_DIRECTORY}/audio/${youtubeVideoId}/${adId}/${fileName}`;
  try {
    fs.copyFileSync(oldPath, newPath);
    const serverPath = `./audio/${youtubeVideoId}/${adId}`;
    return serverPath;
  } catch (err) {
    logger.error(err);
    return oldPath;
  }
};

export const deepCopyAudioClip = async (
  audioDescriptionId: string,
  deepCopiedAudioDescriptionId: string,
  userIdTo: string,
  videoId: string,
): Promise<string[] | null> => {
  const copiedClips = [];
  if (CURRENT_DATABASE === 'mongodb') {
    // get all audio clips for the audio description
    const audioClips = await MongoAudioClipsModel.find({
      audio_description: audioDescriptionId,
    }).catch(err => {
      logger.error(`Error getting audio clips for the audio description: ${err}`);
      return null;
    });
    if (!audioClips) {
      logger.error('No audio clips found for the audio description');
      return null;
    }
    // deep copy the clips with different user id
    for (let i = 0; i < audioClips.length; i++) {
      const audioClip = audioClips[i];
      // console.log('audioClip', audioClip);
      const newPath = copyAudioClipFile(audioClip.file_path, videoId, audioClip.file_name, deepCopiedAudioDescriptionId);
      const copiedClip = await MongoAudioClipsModel.create({
        description_type: audioClip.description_type === null ? 'Visual' : audioClip.description_type,
        description_text: audioClip.description_text,
        playback_type: audioClip.playback_type,
        start_time: audioClip.start_time,
        end_time: audioClip.end_time,
        duration: audioClip.duration,
        file_path: newPath,
        file_name: audioClip.file_name,
        file_mime_type: audioClip.file_mime_type,
        file_size_bytes: audioClip.file_size_bytes,
        audio_description: deepCopiedAudioDescriptionId,
        user: userIdTo,
        video: audioClip.video,
        created_at: nowUtc(),
        updated_at: nowUtc(),
        transcript: audioClip.transcript,
        label: audioClip.label,
      }).catch(err => {
        logger.error(`Error creating a deep copy of the audio clip: ${err}`);
        return null;
      });
      copiedClips.push(copiedClip);
    }
  }
  // return the deep copied clip ids
  return copiedClips.map(copiedClip => copiedClip._id);
};
