import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseSet } from './set.entity';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';

@Injectable()
export class SetsService {
  constructor(
    @InjectRepository(ExerciseSet)
    private setRepository: Repository<ExerciseSet>,
  ) {}

  findAll(exerciseId: number) {
    return this.setRepository.find({
      where: { exerciseId },
      order: { setOrder: 'ASC' },
    });
  }

  async findOne(setId: number, exerciseId: number) {
    const set = await this.setRepository.findOneBy({ setId, exerciseId });
    if (!set) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return set;
  }

  create(dto: CreateSetDto, exerciseId: number) {
    const set = this.setRepository.create({ ...dto, exerciseId });
    return this.setRepository.save(set);
  }

  async update(setId: number, dto: UpdateSetDto, exerciseId: number) {
    const result = await this.setRepository.update({ setId, exerciseId }, dto);
    if (result.affected === 0) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return this.findOne(setId, exerciseId);
  }

  async remove(setId: number, exerciseId: number) {
    const result = await this.setRepository.delete({ setId, exerciseId });
    if (result.affected === 0) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return { deleted: true };
  }
}
