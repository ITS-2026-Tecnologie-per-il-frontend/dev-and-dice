"""Small pure helpers for validating extracted 2014 tables, never app overrides."""
from core_rules import FULL_SLOTS


def ability_modifier(score):
    if isinstance(score,bool) or not isinstance(score,int) or not 1<=score<=30:
        raise ValueError('Ability score must be an integer from 1 to 30.')
    return (score-10)//2


def multiclass_slots(class_levels,third_caster_classes=()):
    if any(isinstance(n,bool) or not isinstance(n,int) or n<0 or n>20 for n in class_levels.values()) or sum(class_levels.values())>20:
        raise ValueError('Character levels must be nonnegative integers totaling at most 20.')
    full=['bard','cleric','druid','sorcerer','wizard']
    eligible=[cls for cls,n in class_levels.items() if n>0 and (cls in full or cls in ['paladin','ranger'] and n>=2 or cls in third_caster_classes and n>=3)]
    # PHB PDF 165: with only one Spellcasting class, retain its own table.
    if len(eligible)==1:
        cls=eligible[0];n=class_levels[cls]
        caster=n if cls in full else (n+1)//2 if cls in ['paladin','ranger'] else (n+2)//3
    else:
        caster=sum(class_levels.get(cls,0) for cls in full)+sum(class_levels.get(cls,0)//2 for cls in ['paladin','ranger'])+sum(class_levels.get(cls,0)//3 for cls in third_caster_classes)
    slots=FULL_SLOTS[caster-1] if caster else []
    return slots+[0]*(9-len(slots))


def concentration_dc(damage):
    if not isinstance(damage,int) or isinstance(damage,bool) or damage<0:
        raise ValueError('Damage must be a nonnegative integer.')
    return max(10,damage//2)
