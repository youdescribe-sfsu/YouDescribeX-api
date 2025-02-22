import compression from 'compression';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import passport from 'passport';
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
import { initPassport } from './models/mongodb/init-models.mongo';
import { checkAndNotify, gpuStatusCronJob, videoStatusCheckJob } from './utils/cron.utils';
import moment from 'moment';

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

  private initializeMiddlewares() {
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use(
      cookieSession({
        name: 'auth-session',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secret: 'YouDescribe Secret',
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
