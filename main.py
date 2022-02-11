import datetime
import sys
from datetime import datetime as dtime
from typing import Generator

from dateutil import rrule
from recurrent import RecurringEvent


def main():
    for line in sys.stdin:
        repeats: str
        repeats, due_date_iso, first_due_date_iso, count_str = line.split("\t")
        count = int(count_str)
        due_date = dtime.fromisoformat(due_date_iso)
        first_due_date = dtime.fromisoformat(first_due_date_iso)

        try:
            next_date_gen = get_dates_generator(repeats, first_due_date, due_date)
        except NonExistantDateError:
            sys.stdout.write("NonExistantDate")
            continue
        except ValueError:
            sys.stdout.write("MalformedRRule")
            continue

        if count == 0:
            sys.stdout.write("\n".join([str(i.date()) for i in next_date_gen]))
        else:
            sys.stdout.write("\n".join([str(next(next_date_gen).date()) for _ in range(count)]))

    sys.stdout.close()


def get_dates_generator(rrule_strings: str, first_due_date: dtime, due_date: dtime) -> Generator[dtime, None, None]:
    rules = rrule.rruleset()
    for rrule_string in rrule_strings.split("; "):
        recurring = RecurringEvent(first_due_date)
        try:
            rule = recurring.parse(rrule_string)
        except TypeError:
            raise NonExistantDateError

        if rule is None:
            raise ValueError
        elif isinstance(rule, dtime):
            rules.rdate(rule)
        elif isinstance(rule, str):
            # WARNING: Ignores recurrences which fall un non-existing dates. Somehow. It somehow handles "every X days",
            # but "monthly" is ignored if the date of the month does not exist for that month.
            rules.rrule(rrule.rrulestr(rule))
        else:
            raise NotImplementedError

    return rules.xafter(due_date, inc=True)


class NonExistantDateError(ValueError):
    pass


if __name__ == "__main__":
    main()
