import { cleanEquipment, describeEquipment } from './gym-equipment';

describe('gym equipment', () => {
  it('trims, collapses spaces and drops empty and double items', () => {
    expect(cleanEquipment([' leg_press ', 'Hack  squat', '', 'hack squat', 'leg_press'])).toEqual([
      'leg_press',
      'Hack squat',
    ]);
  });

  it('gives the coach English names for known keys and typed names as they are', () => {
    expect(describeEquipment(['dumbbells', 'pec_deck', 'Belt squat'])).toEqual([
      'Dumbbells',
      'Pec deck',
      'Belt squat',
    ]);
  });

  it('gives nothing when the user set nothing, so plans assume a full gym', () => {
    expect(describeEquipment(null)).toBeUndefined();
    expect(describeEquipment([])).toBeUndefined();
  });
});
