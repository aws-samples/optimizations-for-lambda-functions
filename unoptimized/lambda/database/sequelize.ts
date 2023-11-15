import { Sequelize, Options as SequelizeOptions, DataTypes } from 'sequelize';
import { Signer } from 'aws-sdk-js-v3-rds-signer';
import { DBParams } from './DBValueObject.js';
import { tracer } from "../powertools/utilities.js";

//check out the implementation for lambda: https://sequelize.org/docs/v6/other-topics/aws-lambda/

class Database {

  private _Stadiums:any
  private _sequelize:Sequelize
  
  @tracer.captureMethod({
    subSegmentName: "### init DB connection"
  })
  public init(params:DBParams){
    
    const sequelizeConfig: SequelizeOptions = {
      host: params.endpoint,
      dialect: "postgres",
      pool:{
        max: 1,
        min: 1,
        idle: 1000
      }
    }

    if (process.env.STAGE !== 'local') {
      sequelizeConfig.dialectOptions = {
        ssl: {
          rejectUnauthorized: true
        }
      };
    }

    const signer = new Signer({
      hostname: params.endpoint,
      port: params.port,
      region: process.env.AWS_REGION,
      username: params.user
    });

    if(this._sequelize){
      // @ts-ignore
      this._sequelize.connectionManager.initPools();
      // @ts-ignore
      if (this._sequelize.connectionManager.hasOwnProperty("getConnection")) {
        // @ts-ignore
        delete this._sequelize.connectionManager.getConnection;
      }
    } else {
      this._sequelize = new Sequelize(params.database || '', params.user || '', params.password || '', sequelizeConfig);
    }
    

    if (process.env.STAGE !== 'local' && !this._sequelize.hasHook('beforeConnect')) {
      this._sequelize.addHook('beforeConnect', async (config) => {
        // @ts-ignore
        config.password = await signer.getAuthToken();
      });
    }

    this._Stadiums = this._sequelize.define('Stadium', {
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      location: {
        type: DataTypes.STRING,
        allowNull: false
      },
      surface: {
        type: DataTypes.STRING,
        allowNull: false
      },
      roof: {
        type: DataTypes.STRING,
        allowNull: false
      },
      team: {
        type: DataTypes.STRING,
        allowNull: false
      },
      yearOpened: {   
        type: DataTypes.STRING,
        allowNull: false
      }
    }, {
      tableName: params.database.toLowerCase()
    });
    
  }

  public get stadiums() {
    return this._Stadiums;
  }

  @tracer.captureMethod({
    subSegmentName: "### authenticate to DB"
  })
  public async authenticate(){
    return await this._sequelize.authenticate()
  }
  @tracer.captureMethod({
    subSegmentName: "### close DB connection"
  })
  public async closeConnection(){
    return await this._sequelize.close();
  }

}
export {Database};