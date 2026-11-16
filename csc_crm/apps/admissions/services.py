from django.db.models import Sum
from .models import Payment, Student, Admission
#==============================Fee Summary Service=======================================
def get_fee_summary():

    total_collected = Payment.objects.filter(
        status='SUCCESS'
    ).aggregate(
        total=Sum('amount')
    )['total'] or 0

    total_outstanding = 0
    pending_students = 0

    for student in Student.objects.all():
        pending = student.pending_amount()

        total_outstanding += pending

        if pending > 0:
            pending_students += 1

    total_receipts = Payment.objects.count()

    return {
        "collected": total_collected,
        "outstanding": total_outstanding,
        "receipts": total_receipts,
        "pending_students": pending_students,
        "total_students": Student.objects.count(),
        "active_students": Admission.objects.filter(status="enrolled").count(),
    }