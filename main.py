import sys
from datetime import datetime

from dateutil import rrule
from dateutil.relativedelta import relativedelta
from recurrent import RecurringEvent


def main():

    for line in sys.stdin:
        repeat, due_date_iso, first_due_date_iso = line.split("\t")
        due_date = datetime.fromisoformat(due_date_iso)
        first_due_date = datetime.fromisoformat(first_due_date_iso)
        # due_date = datetime.now()
        # print("Due date:", due_date)
        # print("First due date:", first_due_date)
        r = RecurringEvent(due_date)
        r.parse(repeat)
        # print(r.get_params())
        x: rrule.rrule = rrule.rrulestr(r.get_RFC_rrule(), dtstart=first_due_date)
        # if first_due_date.day >= 28:
        #     print(first_due_date, first_due_date+relativedelta(days=1))
        #     if first_due_date.month != (first_due_date+relativedelta(days=1)).month:
        #         x = x.replace(bymonthday=-1)
                # x = x.replace(bymonthday=[28, 29, 30, 31], bysetpos=-1)
            # elif first_due_date.month != (first_due_date+relativedelta(day=2)).month:
            #     x = x.replace(bymonthday=-2)
            # else:
            #     x = x.replace(bymonthday=-3)
        # print(x.)
        # TODO: Should filter which ones will be created
        # WARNING: Ignores recurrences which fall un non-existing dates. Somehow. It somehow handles "every X days", but "monthly" is ignored if the date of the month does not exist for that month.
        sys.stdout.write("\n".join([str(i.date()) for i in x.xafter(due_date, count=5)]))
        # print(recurrent.format(x))
        # print(x.get_params())
    sys.stdout.close()


if __name__ == "__main__":
    main()
