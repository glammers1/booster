/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BoosterConfig,
  Logger,
  EntityInterface,
  ReadModelInterface,
  UUID,
  Class,
  Searcher,
} from '@boostercloud/framework-types'
import { Importer } from './importer'
import { buildLogger } from './booster-logger'
import { BoosterEventDispatcher } from './booster-event-dispatcher'
import { BoosterAuth } from './booster-auth'
import { fetchEntitySnapshot } from './entity-snapshot-fetcher'
import { BoosterGraphQLDispatcher } from './booster-graphql-dispatcher'
import { BoosterSubscribersNotifier } from './booster-subscribers-notifier'

/**
 * Main class to interact with Booster and configure it.
 * Sensible defaults are used whenever possible:
 * - `provider`: `Provider.AWS`
 * - `appName`: `new-booster-app`
 * - `region`: 'eu-west-1'
 */
export class Booster {
  private static logger: Logger
  private static readonly config = new BoosterConfig(checkAndGetCurrentEnv())
  /**
   * Avoid creating instances of this class
   */
  private constructor() {}

  public static configureCurrentEnv(configurator: (config: BoosterConfig) => void): void {
    configurator(this.config)
  }

  /**
   * Allows to configure the Booster project.
   *
   * @param environment The name of the environment you want to configure
   * @param configurator A function that receives the configuration object to set the values
   */
  public static configure(environment: string, configurator: (config: BoosterConfig) => void): void {
    this.config.addConfiguredEnvironment(environment)
    if (this.config.environmentName === environment) {
      configurator(this.config)
    }
  }

  /**
   * Initializes the Booster project
   */
  public static start(): void {
    this.logger = buildLogger(this.config.logLevel)
    Importer.importUserProjectFiles()
    this.config.validate()
  }

  /**
   * This function returns a "Searcher" configured to search instances of the read model class passed as param.
   * For more information, check the Searcher class.
   * @param readModelClass The class of the read model you what to run searches for
   */
  public static readModel<TReadModel extends ReadModelInterface>(
    readModelClass: Class<TReadModel>
  ): Searcher<TReadModel> {
    const searchFunction = this.config.provider.readModels.search.bind(null, this.config, this.logger)
    return new Searcher(readModelClass, searchFunction)
  }

  /**
   * Entry point to validate users upon sign up
   */
  public static checkSignUp(signUpRequest: any): Promise<any> {
    return BoosterAuth.checkSignUp(signUpRequest, this.config, this.logger)
  }

  /**
   * Dispatches event messages to your application.
   */
  public static dispatchEvent(rawEvent: any): Promise<any> {
    return BoosterEventDispatcher.dispatch(rawEvent, this.config, this.logger)
  }

  public static authorizeRequest(request: any): Promise<any> {
    return BoosterAuth.authorizeRequest(request, this.config, this.logger)
  }

  public static serveGraphQL(request: any): Promise<any> {
    return new BoosterGraphQLDispatcher(this.config, this.logger).dispatch(request)
  }

  public static notifySubscribers(request: any): Promise<any> {
    return new BoosterSubscribersNotifier(this.config, this.logger).dispatch(request)
  }

  /**
   * Fetches the last known version of an entity
   * @param entityName Name of the entity class
   * @param entityID
   */
  public static fetchEntitySnapshot<TEntity extends EntityInterface>(
    entityClass: Class<TEntity>,
    entityID: UUID
  ): Promise<TEntity | undefined> {
    return fetchEntitySnapshot(this.config, this.logger, entityClass, entityID)
  }
}

function checkAndGetCurrentEnv(): string {
  const env = process.env.BOOSTER_ENV
  if (!env || env.trim().length == 0) {
    throw new Error(
      'Booster environment is missing. You need to provide an environment to configure your Booster project'
    )
  }
  return env
}

export async function boosterEventDispatcher(rawEvent: any): Promise<any> {
  return Booster.dispatchEvent(rawEvent)
}

export async function boosterPreSignUpChecker(rawMessage: any): Promise<void> {
  return Booster.checkSignUp(rawMessage)
}

export async function boosterRequestAuthorizer(rawRequest: any): Promise<any> {
  return Booster.authorizeRequest(rawRequest)
}

export async function boosterServeGraphQL(rawRequest: any): Promise<void> {
  return Booster.serveGraphQL(rawRequest)
}

export async function boosterNotifySubscribers(rawRequest: any): Promise<void> {
  return Booster.notifySubscribers(rawRequest)
}
