import { WorkoutsService } from './workouts.service';
export declare class WorkoutsController {
    private readonly workoutsService;
    constructor(workoutsService: WorkoutsService);
    findAll(): {
        id: number;
        date: string;
        note: string;
    }[];
}
