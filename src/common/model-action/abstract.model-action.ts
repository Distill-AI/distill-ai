import type {
  DeepPartial,
  DeleteResult,
  EntityManager,
  FindOneOptions,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsWhere,
  ObjectType,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';

export interface TransactionOptions {
  useTransaction: false;
  transaction?: never;
}

export interface ActiveTransactionOptions {
  useTransaction: true;
  transaction: EntityManager;
}

export type AnyTransactionOptions = TransactionOptions | ActiveTransactionOptions;

export interface PaginationPayload {
  page: number | string;
  limit: number | string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface PaginatedResult<T> {
  payload: T[];
  paginationMeta: PaginationMeta | { total: number };
}

function computePaginationMeta(total: number, limit: number, page: number): PaginationMeta {
  const total_pages = Math.ceil(total / limit);
  return {
    total,
    limit,
    page,
    total_pages,
    has_next: page < total_pages,
    has_previous: page > 1,
  };
}

export abstract class AbstractModelAction<T extends object> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly model: ObjectType<T>,
  ) {}

  /** Insert a single record. Pass `useTransaction: true` + `transaction` to enlist in a unit of work. */
  async create(options: {
    createPayload: DeepPartial<T>;
    transactionOptions: AnyTransactionOptions;
  }): Promise<T> {
    const repo = this.repoFor(options.transactionOptions);
    return repo.save(options.createPayload as DeepPartial<T>);
  }

  /** Fetch one record by an arbitrary where clause. Does not require a transaction. */
  async get(options: {
    identifierOptions: FindOptionsWhere<T>;
    relations?: FindOptionsRelations<T>;
    queryOptions?: Omit<FindOneOptions<T>, 'where' | 'relations'>;
  }): Promise<T | null> {
    return this.repository.findOne({
      where: options.identifierOptions,
      relations: options.relations,
      ...options.queryOptions,
    });
  }

  /** Fetch an array of records. `transactionOptions` is required; use `findOptions` not `filterRecordOptions`. */
  async find(options: {
    findOptions?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    transactionOptions: AnyTransactionOptions;
    paginationPayload?: PaginationPayload;
    order?: FindOptionsOrder<T>;
  }): Promise<PaginatedResult<T>> {
    const repo = this.repoFor(options.transactionOptions);
    const orderBy = options.order ?? {};

    if (options.paginationPayload) {
      const limit = +options.paginationPayload.limit;
      const page = +options.paginationPayload.page;
      const [payload, total] = await Promise.all([
        repo.find({ where: options.findOptions, take: limit, skip: limit * (page - 1), order: orderBy }),
        repo.count({ where: options.findOptions }),
      ]);
      return { payload, paginationMeta: computePaginationMeta(total, limit, page) };
    }

    const payload = await repo.find({ where: options.findOptions, order: orderBy });
    return { payload, paginationMeta: { total: payload.length } };
  }

  /** Fetch a paginated page. Returns `{ payload, paginationMeta }`. */
  async list(options: {
    filterRecordOptions?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    paginationPayload?: PaginationPayload;
    relations?: FindOptionsRelations<T>;
    order?: FindOptionsOrder<T>;
  }): Promise<PaginatedResult<T>> {
    const orderBy = options.order ?? {};

    if (options.paginationPayload) {
      const limit = +options.paginationPayload.limit;
      const page = +options.paginationPayload.page;
      const [payload, total] = await Promise.all([
        this.repository.find({
          where: options.filterRecordOptions,
          relations: options.relations,
          take: limit,
          skip: limit * (page - 1),
          order: orderBy,
        }),
        this.repository.count({ where: options.filterRecordOptions }),
      ]);
      return { payload, paginationMeta: computePaginationMeta(total, limit, page) };
    }

    const payload = await this.repository.find({
      where: options.filterRecordOptions,
      relations: options.relations,
      order: orderBy,
    });
    return { payload, paginationMeta: { total: payload.length } };
  }

  /** Update one record matching `identifierOptions` and return the refreshed row. */
  async update(options: {
    identifierOptions: FindOptionsWhere<T>;
    updatePayload: QueryDeepPartialEntity<T>;
    transactionOptions: AnyTransactionOptions;
  }): Promise<T | null> {
    const repo = this.repoFor(options.transactionOptions);
    await repo.update(options.identifierOptions, options.updatePayload);
    return repo.findOne({ where: options.identifierOptions });
  }

  /** Delete one record matching `identifierOptions`. */
  async delete(options: {
    identifierOptions: FindOptionsWhere<T>;
    transactionOptions: AnyTransactionOptions;
  }): Promise<DeleteResult> {
    const repo = this.repoFor(options.transactionOptions);
    return repo.delete(options.identifierOptions);
  }

  /** Save an entity instance (insert or update based on primary key presence). */
  async save(options: { entity: DeepPartial<T>; transactionOptions: AnyTransactionOptions }): Promise<T> {
    const repo = this.repoFor(options.transactionOptions);
    return repo.save(options.entity);
  }

  private repoFor(opts: AnyTransactionOptions): Repository<T> {
    return opts.useTransaction ? opts.transaction.getRepository(this.model) : this.repository;
  }
}
