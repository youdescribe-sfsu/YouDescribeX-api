import axios, { AxiosResponse } from 'axios';
import { MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { IVideo } from '../models/mongodb/Videos.mongo';
import { getVideoDataByYoutubeId } from '../services/videos.util';
import { GPU_URL } from '../config';
import moment from 'moment';

/**
 * @method isEmpty
 * @param {String | Number | Object} value
 * @returns {Boolean} true & false
 * @description this value is Empty Check
 */
export const isEmpty = (value: string | number | object): boolean => {
  if (value === null) {
    return true;
  } else if (typeof value !== 'number' && value === '') {
    return true;
  } else if (typeof value === 'undefined' || value === undefined) {
    return true;
  } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
    return true;
  } else {
    return false;
  }
};
/**
 * @method convertISO8601ToSeconds
 * @param {String} input
 * @returns {number} duration
 * @description the input is from the YouTube API key regarding the duration of the YouTube video and converts it into seconds
 */
export const convertISO8601ToSeconds = (input: string): number => {
  const reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let totalseconds;
  if (reptms.test(input)) {
    const matches = reptms.exec(input);
    if (matches[1]) hours = Number(matches[1]);
    if (matches[2]) minutes = Number(matches[2]);
    if (matches[3]) seconds = Number(matches[3]);
    totalseconds = hours * 3600 + minutes * 60 + seconds;
  }
  return totalseconds;
};

export const getYouTubeVideoStatus = async (youtube_id: string): Promise<IVideo> => {
  const videoIdStatus = await MongoVideosModel.findOne({ youtube_id });
  if (videoIdStatus) {
    return videoIdStatus;
  } else {
    const videoMeta = await getVideoDataByYoutubeId(youtube_id);

    const newVid = new MongoVideosModel({
      audio_descriptions: [],
      category: videoMeta.category,
      category_id: videoMeta.category_id,
      youtube_id: youtube_id,
      title: videoMeta.title,
      duration: videoMeta.duration,
      description: videoMeta.description,
      tags: videoMeta.tags,
      custom_tags: [],
      views: 0,
      youtube_status: 'ready',
      updated_at: nowUtc(),
    });
    const newSavedVideo = await newVid.save();
    return newSavedVideo;
  }
};

export const checkGPUServerStatus = async (): Promise<boolean> => {
  try {
    if (GPU_URL === null) throw new Error('GPU_URL is not defined');
    await axios.get(`${GPU_URL}/health_check`);
    return true;
  } catch (error) {
    console.error('Error checking GPU server status:', error.code);
    return false;
  }
};

export const getEmailForUser = async (user_id: string): Promise<string> => {
  const user = await MongoUsersModel.findById(user_id);

  if (user === null) throw new Error('User not found');
  return user.email;
};

export const formattedDate = (now: Date) =>
  `${now.getUTCFullYear()}${padZero(now.getUTCMonth() + 1)}${padZero(now.getUTCDate())}` +
  `${padZero(now.getUTCHours())}${padZero(now.getUTCMinutes())}${padZero(now.getUTCSeconds())}`;

function padZero(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export const utcToLongInt = (timestampUtc: number): number => {
  const date = new Date(timestampUtc);
  const formattedDate =
    `${date.getUTCFullYear()}${padZero(date.getUTCMonth() + 1)}${padZero(date.getUTCDate())}` +
    `${padZero(date.getUTCHours())}${padZero(date.getUTCMinutes())}${padZero(date.getUTCSeconds())}`;

  return parseInt(formattedDate);
};

export const nowUtc = () => moment().utc().format('YYYYMMDDHHmmss') as unknown as number;
