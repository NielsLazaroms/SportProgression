import {Injectable} from '@nestjs/common';

@Injectable()
export class WorkoutsService {
  findAll() {
    return [
      { id: 1, date: '2025-03-18', note: 'Leg day' },
      { id: 2, date: '2025-03-20', note: 'Push workout' },
      { id: 3, date: '2025-03-22', note: 'Pull workout' }
    ];
   }
}
