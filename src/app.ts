import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { NODE_ENV, PORT, CURRENT_DATABASE } from './config';
import { testDataBaseConnection } from './databases';
import { Routes } from './interfaces/routes.interface';
import errorMiddleware from './middlewares/error.middleware';
import { logger } from './utils/logger';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import options from './swaggerOptions';
import yaml from 'js-yaml';
import fs from 'fs';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;
  public currentDatabase: string;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;
    this.currentDatabase = CURRENT_DATABASE || 'mongo';

    // this.connectToDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeErrorHandling();
    this.testDatabase();
    this.initializeSwagger();
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
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    this.app.use('/api/static', express.static(path.join(__dirname, '../', 'public')));
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
}

export default App;
