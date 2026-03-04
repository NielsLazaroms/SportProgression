import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly dataSource: DataSource) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onModuleInit() {
    try {
      const result = await this.dataSource.query('SELECT 1 AS ok');
      this.logger.log(`DB connected. Test query result: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error('DB connection failed:', err);
    }
  }
}
