import django_filters
from django.db.models import Q
from .models import Student
#==============================STUDENT FILTER=======================================
class StudentFilter(django_filters.FilterSet):

    search = django_filters.CharFilter(method='custom_search')
    id = django_filters.NumberFilter(field_name='id')
    phone_no = django_filters.CharFilter( field_name='phone_no',lookup_expr='iexact')
    course_name  = django_filters.CharFilter( field_name='admissions__course_name__course_name',lookup_expr='iexact')
    batch = django_filters.NumberFilter(field_name='admissions__enrollment__batch__id')
    status = django_filters.CharFilter( field_name='admissions__status',lookup_expr='iexact')
    payment_status = django_filters.CharFilter(method='filter_payment_status')


    class Meta:
        model = Student
        fields = [
            'search', 'id', 'phone_no',
            'course_name', 'batch', 'status', 'payment_status'
        ]

    def custom_search(self, queryset, name, value):
        terms = value.split()
        query = Q()

        for term in terms:
            query &= (
                Q(first_name__istartswith=term) |
                Q(last_name__istartswith=term)
            )

        if value.isdigit():
            query |= Q(id=int(value))

        return queryset.filter(query).distinct()
    
    def filter_payment_status(self, queryset, name, value):
        student_ids = []

        for student in queryset:
            total_fee = student.total_fee()
            total_paid = student.total_paid()

            if value == "Paid" and total_paid >= total_fee:
                student_ids.append(student.id)

            elif value == "Partial" and 0 < total_paid < total_fee:
                student_ids.append(student.id)

            elif value == "Pending" and total_paid == 0:
                student_ids.append(student.id)

        return queryset.filter(id__in=student_ids)