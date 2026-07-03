import compression from 'compression';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import passport from 'passport';
import cors from 'cors';
import express, { Application } from 'express';
import { NODE_ENV, PORT, CURRENT_DATABASE, AUDIO_DIRECTORY } from './config';
import { testDataBaseConnection } from './databases';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import { logger } from './utils/logger';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import options from './swaggerOptions';
import yaml from 'js-yaml';
import fs from 'fs';
import { initPassport, MongoAICaptionRequestModel, MongoVideosModel } from './models/mongodb/init-models.mongo';
import { checkAndNotify, gpuStatusCronJob, videoStatusCheckJob } from './utils/cron.utils';
import { stuckProcessingSweeperJob } from './utils/aiRequestSweeper.utils';
import moment from 'moment';
import YouTubeProxyRoute from './routes/youtube-proxy.route';
import UsersRoute from './routes/users.route';
import mongoose from 'mongoose';

class App {
  public static numOfVideosFromYoutube = 0;
  public app: Application;
  public env: string;
  public port: string | number;
  public currentDatabase: string;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;
    this.currentDatabase = CURRENT_DATABASE || 'mongo';

    this.testDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeErrorHandling();
    this.initializeSwagger();
    initPassport();
    this.initializeCronJobs();
    this.initializeQueueRecovery(routes);
  }

  // Rebuild the in-memory AI-processing queue from Mongo once the DB is connected, so
  // pending/orphaned requests survive a server restart. Reaches the single UserService
  // instance the dispatcher actually uses (UsersRoute -> usersController.userService).
  private initializeQueueRecovery(routes: Routes[]) {
    const usersRoute = routes.find((r): r is UsersRoute => r instanceof UsersRoute);
    if (!usersRoute) {
      logger.warn('Queue recovery skipped: UsersRoute not found in routes');
      return;
    }
    const run = () => usersRoute.usersController.userService.recoverPendingQueue().catch((err: any) => logger.error(`Queue recovery error: ${err.message}`));

    // testDatabase() starts an un-awaited mongoose.connect(); run after it has connected.
    if (mongoose.connection.readyState === 1) run();
    else mongoose.connection.once('connected', run);
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`=================================`);
    });
  }

  public getServer() {
    return this.app;
  }

  private testDatabase() {
    testDataBaseConnection();
  }

  private async initializeMiddlewares() {
    if (NODE_ENV === 'development') {
      this.app.use(
        cors({
          origin: ['http://localhost:3000', 'https://ydx-dev.youdescribe.org'],
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'audiodescription'],
        }),
      );
    }
    this.app.set('trust proxy', 1);
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use(
      cookieSession({
        name: 'auth-session-dev-v2',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secret: 'YouDescribe Secret',
        domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
        sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
        secure: NODE_ENV === 'production',
      }),
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    logger.info(`AUDIO_DIRECTORY: ${AUDIO_DIRECTORY}`);
    this.app.use('/api/static', express.static(AUDIO_DIRECTORY));

    // Add a preflight handler for all routes
    this.app.options('*', (req, res) => {
      res.sendStatus(200);
    });

    await this.createIndexes();
  }

  private async createIndexes() {
    try {
      if (mongoose.connection.readyState !== 1) {
        await new Promise<void>((resolve, reject) => {
          mongoose.connection.once('connected', () => resolve());
          mongoose.connection.once('error', err => reject(err));
        });
      }
      const aiRequestsCollection = MongoAICaptionRequestModel.collection;
      const videosCollection = MongoVideosModel.collection;

      await aiRequestsCollection.createIndex({ caption_requests: 1 });
      await aiRequestsCollection.createIndex({ youtube_id: 1 });
      await videosCollection.createIndex({ youtube_id: 1 });

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes:', error);
    }
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/api/', route.router);
    });
  }

  private initializeSwagger() {
    const specs = swaggerJsdoc(options);
    const swaggerSpecYaml = yaml.dump(specs);
    fs.writeFile('./swagger.yaml', swaggerSpecYaml, err => {
      if (err) {
        console.log(err);
      }
    });
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }

  private initializeCronJobs() {
    console.log('Initializing Cron Jobs');
    logger.info('Initializing Cron Jobs');
    this.resetNumOfVideos();
    checkAndNotify();
    gpuStatusCronJob.start();
    videoStatusCheckJob.start();
    stuckProcessingSweeperJob.start();
    this.setupVideoCountIntervals();
  }

  private setupVideoCountIntervals() {
    setInterval(() => {
      console.log('Number of videos fetched from YouTube API service: ' + App.numOfVideosFromYoutube);
    }, 15 * 60 * 1000);

    setInterval(() => {
      const now = moment().format('H:mm:ss');
      if (now === '12:00:00') {
        this.resetNumOfVideos();
      }
    }, 1000);
  }

  private resetNumOfVideos() {
    App.numOfVideosFromYoutube = 0;
  }
}

export default App;
