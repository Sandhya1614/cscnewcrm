import os
import uuid
from django.http import HttpResponse, JsonResponse, Http404
from django.shortcuts import redirect, render, get_object_or_404
from django.core.paginator import Paginator
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from django.contrib.staticfiles import finders
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from playwright.async_api import async_playwright
from asgiref.sync import async_to_sync

from .forms import StudentForm, AdmissionForm, EnrollmentForm
from .models import *
from .filters import StudentFilter
from .services import get_fee_summary
from csc_crm.apps.student_attendance.models import Batch
from csc_crm.apps.admissions.models import Payment
from django.db.models import Prefetch, Sum, Count
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from csc_crm.apps.leads.models import LeadCapture
from csc_crm.apps.staff.validators import get_name_error

def get_role(request):
    staff = getattr(request.user, 'staff_profile', None)
    return staff.role.role_name if staff and staff.role else None


def is_admin_manager(request):
    return get_role(request) in ['Admin', 'Manager']


def is_sales_team(request):
    return get_role(request) in ['Sales Exec Lead', 'Sales Exec']


def is_hr(request):
    return get_role(request) == 'HR'


def is_trainer(request):
    return get_role(request) == 'Trainer'


def get_selected_batch(request):
    """
    Validates ?batch=<id>.
      - no batch param            -> None (normal list)
      - invalid / missing batch   -> 404
      - Trainer, someone else's   -> 403
    """
    batch_param = request.GET.get('batch')

    if not batch_param:
        return None

    if not batch_param.isdigit():
        raise Http404("Batch not found")

    batch = (
        Batch.objects.select_related('course')
        .filter(id=batch_param)
        .first()
    )

    if not batch:
        raise Http404("Batch not found")

    if get_role(request) == 'Trainer':
        my_staff = getattr(request.user, 'staff_profile', None)
        if not my_staff or batch.trainer_id != my_staff.pk:
            raise PermissionDenied

    return batch
 
 
@login_required
def search_lead_for_admission(request):
    """Lead lookup for the Student Register 'First Name' autofill."""
 
    query = request.GET.get('q', '').strip()
 
    results = []
 
    if len(query) >= 2:
        leads = LeadCapture.objects.filter(
            lead_name__icontains=query
        ).order_by('lead_name')[:10]
 
        results = [
            {
                'id': lead.id,
                'lead_name': lead.lead_name,
                'email': lead.email,
                'phone_no': lead.phone_no,
                'course_interested': lead.course_interested,
                'course_interested_label': lead.get_course_interested_display(),
            }
            for lead in leads
        ]
 
    return JsonResponse({'leads': results})

def student(request):
    if not (is_admin_manager(request) or is_sales_team(request)):
        messages.error(request, "You do not have permission to access this page.")
        return redirect('staff_dashboard')

    student_form = StudentForm()
    admission_form = AdmissionForm()
    enrollment_form = EnrollmentForm()
    courses = Course.objects.all()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    locked_batch = None
    batch_param = request.GET.get('batch')

    if batch_param and batch_param.isdigit():
        locked_batch = (
            Batch.objects.select_related('course')
            .filter(id=batch_param)
            .first()
        )

    if request.method == "POST":
        student_form = StudentForm(request.POST, request.FILES)
        admission_form = AdmissionForm(request.POST)
        enrollment_form = EnrollmentForm(request.POST, request.FILES)

        if student_form.is_valid() and admission_form.is_valid() and enrollment_form.is_valid():
            enrollment_preview = enrollment_form.save(commit=False)

            if enrollment_preview.batch.course_id != admission_form.cleaned_data['course_name'].id:
                error_msg = "Selected batch does not belong to selected course."

                if is_ajax:
                    return JsonResponse({
                        'success': False,
                        'errors': {'batch': [error_msg]}
                    })

                messages.error(request, error_msg)
                return render(request, 'admissions/register.html', {
                    'student_form': student_form,
                    'admission_form': admission_form,
                    'enrollment_form': enrollment_form,
                    'courses': courses,
                })

            try:
                with transaction.atomic():
                    student_obj = student_form.save()

                    for file in request.FILES.getlist("id_proof"):
                        StudentDocument.objects.create(
                            student=student_obj,
                            document_type="id_proof",
                            document=file
                        )

                    for file in request.FILES.getlist("certificate"):
                        StudentDocument.objects.create(
                            student=student_obj,
                            document_type="certificate",
                            document=file
                        )

                    admission = Admission.objects.create(
                        student=student_obj,
                        course_name=admission_form.cleaned_data['course_name'],
                        status="enrolled"
                    )

                    enrollment = enrollment_form.save(commit=False)
                    enrollment.admission = admission
                    enrollment.save()

                if is_ajax:
                    return JsonResponse({
                        'success': True,
                        'redirect_url': reverse(
                            'staff_dashboard' if is_sales_team(request)
                            else 'fee_dashboard'
                        )
                    })

                messages.success(request, "Student enrolled successfully!")

                if is_sales_team(request):
                    return redirect('staff_dashboard')

                return redirect('fee_dashboard')

            except Exception as e:
                if is_ajax:
                    return JsonResponse({
                        'success': False,
                        'errors': {
                            '__all__': [f"Something went wrong while saving: {e}"]
                        }
                    })

                messages.error(
                    request,
                    f"Something went wrong while saving the student: {e}"
                )
        else:
            if is_ajax:
                return JsonResponse({
                    'success': False,
                    'errors': {
                        **student_form.errors,
                        **admission_form.errors,
                        **enrollment_form.errors,
                    }
                })

            messages.error(request, "Form has errors. Please check!")

    return render(request, 'admissions/register.html', {
        'student_form': student_form,
        'admission_form': admission_form,
        'enrollment_form': enrollment_form,
        'courses': courses,
        'locked_batch': locked_batch,
    })


def delete_student_document(request, pk):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to delete documents.")
        return redirect('student_list')

    document = get_object_or_404(StudentDocument, pk=pk)
    student_id = document.student.id
    document_display_name = (
        os.path.basename(document.document.name)
        if document.document else "Document"
    )

    if request.method == "POST":
        if document.document:
            document.document.delete(save=False)

        document.delete()
        messages.success(
            request,
            f"Document '{document_display_name}' deleted successfully."
        )

    return redirect("edit_student", id=student_id)


def _get_summary_value(summary, key, default=0):
    if isinstance(summary, dict):
        return summary.get(key, default)
    return getattr(summary, key, default)


@login_required(login_url='staff_login')
def fee_dashboard(request):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to access fee dashboard.")
        return redirect('staff_dashboard')

    students = (
        Student.objects
        .prefetch_related(
            Prefetch(
                'admissions',
                queryset=Admission.objects.select_related('course_name', 'enrollment__batch')
            ),
            'payments'
        )
        .annotate(total_paid_db=Sum('payments__amount'))
        .order_by('-id')
    )

    selected_batch_id = request.GET.get("batch", "")
    batches = Batch.objects.select_related('course').order_by('batch_name')

    batch_totals = {}

    fee_students = []
    student_fee_status = []

    for student in students:
        admission = student.admissions.first()

        enrollment = getattr(admission, 'enrollment', None) if admission else None
        batch = enrollment.batch if enrollment and enrollment.batch else None
        course = admission.course_name if admission and admission.course_name else None

        total_fee = (
            admission.course_name.course_fee
            if admission and admission.course_name else 0
        )

        paid = student.total_paid_db or 0
        pending = max(total_fee - paid, 0)

        if batch:
            bt = batch_totals.setdefault(
                batch.id,
                {"label": batch.batch_name, "paid": 0, "pending": 0}
            )
            bt["paid"] += float(paid)
            bt["pending"] += float(pending)

        if pending > 0:
            fee_students.append(student)

        if pending <= 0:
            status = "Paid"
        elif paid == 0:
            status = "Pending"
        else:
            status = "Partial"

        if selected_batch_id and (not batch or str(batch.id) != selected_batch_id):
            continue

        student_fee_status.append({
            "student": student,
            "batch": batch,
            "course": course,
            "total_fee": total_fee,
            "paid": paid,
            "pending": pending,
            "status": status,
        })

    latest_payments = (
        Payment.objects
        .select_related('student')
        .order_by('-date', '-id')[:5]
    )

    selected_student_id = request.GET.get("student_id")
    remaining_payments = 0

    if request.method == "POST":
        student_id = request.POST.get("student")

        try:
            amount = float(request.POST.get("amount"))
        except (TypeError, ValueError):
            messages.error(request, "Invalid amount.")
            return redirect("fee_dashboard")

        mode = request.POST.get("mode")
        reference = request.POST.get("reference") or f"TXN{uuid.uuid4().hex[:8].upper()}"
        remarks = request.POST.get("remarks")

        student_obj = Student.objects.prefetch_related(
            Prefetch(
                'admissions',
                queryset=Admission.objects.select_related('course_name')
            ),
            'payments'
        ).get(id=student_id)

        admission = student_obj.admissions.first()

        total_fee = (
            admission.course_name.course_fee
            if admission and admission.course_name else 0
        )

        paid_amount = sum(p.amount for p in student_obj.payments.all())
        pending_amount = max(total_fee - paid_amount, 0)

        if amount <= 0:
            messages.error(request, "Amount must be greater than 0.")
            return redirect("fee_dashboard")

        if amount > pending_amount:
            messages.error(
                request,
                f"Only remaining amount ₹{pending_amount} can be paid."
            )
            return redirect("fee_dashboard")

        payment_count = student_obj.payments.count()

        if payment_count >= 6:
            messages.error(request, "Only 6 payments allowed.")
            return redirect("fee_dashboard")

        if payment_count == 5 and amount != pending_amount:
            messages.error(
                request,
                f"6th payment must clear full remaining amount ₹{pending_amount}"
            )
            return redirect("fee_dashboard")

        Payment.objects.create(
            student=student_obj,
            amount=amount,
            mode=mode,
            reference_id=reference,
            remarks=remarks,
        )

        remaining_payments = 6 - (payment_count + 1)

        if pending_amount - amount <= 0:
            messages.success(request, "Payment Successful! Full fee has been paid.")
        else:
            messages.success(
                request,
                f"Payment Successful! Remaining payments: {remaining_payments}"
            )

        return redirect("fee_dashboard")

    if request.GET.get("format") == "excel":
        wb = Workbook()
        ws = wb.active
        ws.title = "Fee Payments"

        ws.append([
            "Student", "Course", "Batch",
            "Amount", "Mode", "Reference", "Date"
        ])

        header_fill = PatternFill(
            start_color="FFC000",
            end_color="FFC000",
            fill_type="solid"
        )

        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        payments = Payment.objects.select_related(
            'student'
        ).prefetch_related(
            Prefetch(
                'student__admissions',
                queryset=Admission.objects.select_related('course_name')
            )
        ).order_by('-date', '-id')

        for payment in payments:
            admission = payment.student.admissions.first()
            enrollment = getattr(admission, "enrollment", None)

            ws.append([
                f"{payment.student.first_name} {payment.student.last_name}",
                admission.course_name.course_name if admission and admission.course_name else "-",
                enrollment.batch.batch_name if enrollment else "-",
                payment.amount,
                payment.mode,
                payment.reference_id,
                str(payment.date),
            ])

        for col, width in {
            "A": 25, "B": 25, "C": 18,
            "D": 15, "E": 15, "F": 20, "G": 18
        }.items():
            ws.column_dimensions[col].width = width

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = 'attachment; filename="fee_payments.xlsx"'
        wb.save(response)
        return response

    summary = get_fee_summary()

    collected = _get_summary_value(summary, "collected", 0) or 0
    outstanding = _get_summary_value(summary, "outstanding", 0) or 0
    total_expected = collected + outstanding

    collection_percentage = (
        round((collected / total_expected) * 100)
        if total_expected else 0
    )

    chart_data = {
        "collection": {
            "collected": float(collected),
            "outstanding": float(outstanding),
        },
        "batches": list(batch_totals.values()),
    }

    return render(request, "admissions/fee_dashboard.html", {
        "students": fee_students,
        "payments": latest_payments,
        "summary": summary,
        "remaining_payments": remaining_payments,
        "student_fee_status": student_fee_status,
        "selected_student_id": selected_student_id,
        "collection_percentage": collection_percentage,
        "batches": batches,
        "selected_batch_id": selected_batch_id,
        "chart_data": chart_data,
    })


@login_required(login_url='staff_login')
def search_student_by_name(request):
    if not is_admin_manager(request):
        raise PermissionDenied

    q = request.GET.get("q", "").strip()

    if len(q) < 2:
        return JsonResponse({"students": []})

    qs = Student.objects.prefetch_related(
        Prefetch(
            'admissions',
            queryset=Admission.objects.select_related('enrollment__batch')
        )
    )

    for word in q.split():
        qs = qs.filter(Q(first_name__icontains=word) | Q(last_name__icontains=word))

    data = []
    for s in qs[:10]:
        admission = s.admissions.first()
        enrollment = getattr(admission, 'enrollment', None) if admission else None
        batch = enrollment.batch if enrollment and enrollment.batch else None

        data.append({
            "id": s.id,
            "name": f"{s.first_name} {s.last_name}".strip(),
            "batch": batch.batch_name if batch else "",
        })

    return JsonResponse({"students": data})


@login_required(login_url='staff_login')
def payment_history_all(request):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to view payment history.")
        return redirect('staff_dashboard')

    payments = Payment.objects.select_related("student").order_by("-date", "-id")

    q = request.GET.get("q", "").strip()
    if q:
        for word in q.split():
            payments = payments.filter(
                Q(student__first_name__icontains=word) |
                Q(student__last_name__icontains=word)
            )

    total_amount = payments.aggregate(total=Sum("amount"))["total"] or 0

    return render(request, "admissions/payment_history.html", {
        "payments": payments,
        "q": q,
        "total_count": payments.count(),
        "total_amount": total_amount,
    })


@login_required(login_url='staff_login')
def student_detail(request, pk):
    if not (is_admin_manager(request) or is_hr(request)):
        messages.error(request, "You do not have permission to view student details.")
        return redirect('staff_dashboard')

    student_obj = get_object_or_404(Student, id=pk)

    payments = student_obj.payments.all()

    return render(request, 'students/detail.html', {
        'student': student_obj,
        'payments': payments,
        'total_paid': student_obj.total_paid(),
        'pending': student_obj.pending_amount(),
    })


def link_callback(uri):
    if uri.startswith(settings.STATIC_URL):
        path = finders.find(
            uri.replace(settings.STATIC_URL, "")
        )
        if path:
            return path

    return uri


async def html_to_pdf(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle")
        await page.wait_for_load_state("networkidle")
        await page.emulate_media(media="print")

        pdf = await page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={
                "top": "8mm",
                "bottom": "8mm",
                "left": "8mm",
                "right": "8mm"
            },
        )

        await browser.close()
        return pdf


def generate_receipt(request, pk):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to generate receipts.")
        return redirect('staff_dashboard')

    payment = get_object_or_404(Payment, id=pk)

    url = request.build_absolute_uri(
        reverse("receipt_pdf", args=[pk])
    )

    pdf = async_to_sync(html_to_pdf)(url)

    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="receipt_{pk}.pdf"'
    )

    return response


def _batch_fee_summary(batch):
    students = (
        Student.objects
        .filter(admissions__enrollment__batch=batch)
        .distinct()
        .prefetch_related(
            Prefetch(
                'admissions',
                queryset=Admission.objects.select_related('course_name')
            ),
            'payments',
        )
    )

    collected = 0
    outstanding = 0
    pending_students = 0

    for s in students:
        admission = s.admissions.first()
        total_fee = (
            admission.course_name.course_fee
            if admission and admission.course_name else 0
        )
        paid = sum(p.amount for p in s.payments.all())
        pending = max(total_fee - paid, 0)

        collected += paid
        outstanding += pending
        if pending > 0:
            pending_students += 1

    return {
        "collected": collected,
        "outstanding": outstanding,
        "pending_students": pending_students,
    }


@login_required(login_url='staff_login')
def _batch_list_response(request, *, overview_url, reset_url,
                         subtitle, show_cards, show_add):
    if not (is_admin_manager(request) or is_hr(request) or is_trainer(request)):
        messages.error(request, "You do not have permission to access this page.")
        return redirect('staff_dashboard')

    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = get_role(request)

    batches_qs = Batch.objects.select_related('course').order_by('batch_name')
    students_qs = Student.objects.all()
    active_qs = Admission.objects.filter(status="enrolled")

    if my_role == 'Trainer':
        batches_qs = batches_qs.filter(trainer=my_staff)
        students_qs = students_qs.filter(
            admissions__enrollment__batch__trainer=my_staff
        ).distinct()
        active_qs = active_qs.filter(enrollment__batch__trainer=my_staff)

    q = request.GET.get('q', '').strip()
    course_id = request.GET.get('course', '')

    if q:
        batches_qs = batches_qs.filter(batch_name__icontains=q)

    if course_id.isdigit():
        batches_qs = batches_qs.filter(course_id=course_id)

    counts = {
        r['batch_id']: r['c']
        for r in Enrollment.objects.values('batch_id').annotate(c=Count('id'))
    }

    batch_rows = [
        {"batch": b, "total_students": counts.get(b.id, 0)}
        for b in batches_qs
    ]

    context = {
        'batch_rows': batch_rows,
        'courses': Course.objects.all(),
        'q': q,
        'selected_course': course_id,
        'overview_url': overview_url,
        'reset_url': reset_url,
        'subtitle': subtitle,
        'show_cards': show_cards,
        'show_add': show_add,
    }

    if show_cards:
        context.update({
            'total_students': students_qs.count(),
            'active_students': active_qs.count(),
            'summary': get_fee_summary(),
        })

    return render(request, 'admissions/batch_list.html', context)


@login_required(login_url='staff_login')
def batch_list(request):
    return _batch_list_response(
        request,
        overview_url='student_list',
        reset_url='batch_list',
        subtitle='Select a batch to view its students',
        show_cards=True,
        show_add=True,
    )


@login_required(login_url='staff_login')
def search_batch_list(request):
    return _batch_list_response(
        request,
        overview_url='search_students',
        reset_url='search_batch_list',
        subtitle='Select a batch to search and filter its students',
        show_cards=False,
        show_add=False,
    )


@login_required(login_url='staff_login')
def student_list(request):
    if not (is_admin_manager(request) or is_hr(request) or is_trainer(request)):
        messages.error(request, "You do not have permission to access student list.")
        return redirect('staff_dashboard')

    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = get_role(request)

    selected_batch = get_selected_batch(request)

    students = Student.objects.prefetch_related(
        'payments',
        'admissions__enrollment',
        'admissions__course_name',
    ).all()

    if my_role == 'Trainer':
        students = students.filter(
            admissions__enrollment__batch__trainer=my_staff
        ).distinct()

    student_filter = StudentFilter(request.GET, queryset=students)
    filtered_students = student_filter.qs.distinct().order_by('-id')

    paginator = Paginator(filtered_students, 10)
    page_obj = paginator.get_page(request.GET.get("page"))

    active_students_qs = Admission.objects.filter(status="enrolled")

    if my_role == 'Trainer':
        active_students_qs = active_students_qs.filter(
            enrollment__batch__trainer=my_staff
        )

    if selected_batch:
        active_students = active_students_qs.filter(
            enrollment__batch=selected_batch
        ).count()
        summary = _batch_fee_summary(selected_batch)
        courses_ctx = Course.objects.filter(id=selected_batch.course_id)
    else:
        active_students = active_students_qs.count()
        summary = get_fee_summary()
        courses_ctx = Course.objects.all()

    format = request.GET.get('format')

    if format == 'excel':
        wb = Workbook()
        ws = wb.active
        ws.title = "Students"

        headers = [
            "Student", "Course", "Batch",
            "Phone", "Payment Status", "Joined"
        ]

        ws.append(headers)

        header_fill = PatternFill(
            start_color="FFC000",
            end_color="FFC000",
            fill_type="solid"
        )

        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        for s in filtered_students:
            for admission in s.admissions.all():
                enrollment = getattr(admission, 'enrollment', None)

                ws.append([
                    f"{s.first_name} {s.last_name}",
                    str(admission.course_name) if admission else "-",
                    str(enrollment.batch)
                    if enrollment and enrollment.batch else "-",
                    s.phone_no,
                    enrollment.payment_status if enrollment else "-",
                    str(enrollment.start_date) if enrollment else "-"
                ])

        for col, width in {
            'A': 25, 'B': 20, 'C': 15,
            'D': 18, 'E': 18, 'F': 18
        }.items():
            ws.column_dimensions[col].width = width

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=students.xlsx'
        wb.save(response)
        return response

    if format == 'pdf':
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="students.pdf"'

        data = [[
            "Student", "Course", "Batch",
            "Phone", "Payment Status", "Joined"
        ]]

        for s in filtered_students:
            for admission in s.admissions.all():
                enrollment = getattr(admission, 'enrollment', None)

                data.append([
                    f"{s.first_name} {s.last_name}",
                    str(admission.course_name) if admission else "-",
                    str(enrollment.batch)
                    if enrollment and enrollment.batch else "-",
                    s.phone_no,
                    enrollment.payment_status if enrollment else "-",
                    str(enrollment.start_date) if enrollment else "-"
                ])

        doc = SimpleDocTemplate(response)
        styles = getSampleStyleSheet()

        title = Paragraph("Student Report", styles['Title'])
        table = Table(data)

        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.gold),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))

        doc.build([
            title,
            Spacer(1, 12),
            table
        ])

        return response

    batches_qs = Batch.objects.all()

    if my_role == 'Trainer':
        batches_qs = batches_qs.filter(trainer=my_staff)

    return render(request, 'admissions/student_list.html', {
        'page_obj': page_obj,
        'filter': student_filter,
        'courses': courses_ctx,
        'selected_batch': selected_batch,
        'batches': batches_qs,
        'total_students': filtered_students.count(),
        'active_students': active_students,
        'summary': summary
    })


@login_required(login_url='staff_login')
def edit_student(request, id):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to edit students.")
        return redirect('student_list')

    student_obj = get_object_or_404(Student, id=id)
    admission = get_object_or_404(Admission, student=student_obj)
    enrollment = get_object_or_404(Enrollment, admission=admission)

    courses = Course.objects.all()

    batches = (
        Batch.objects.filter(course_id=admission.course_name_id)
        if admission.course_name_id
        else Batch.objects.none()
    )

    if request.method == 'POST':
        for field, label in (('first_name', 'First name'), ('last_name', 'Last name')):
            name_error = get_name_error(request.POST.get(field))
            if name_error:
                messages.error(request, f"{label}: {name_error}")
                return redirect('edit_student', id=id)

        student_obj.first_name = request.POST.get('first_name').strip()
        student_obj.last_name = request.POST.get('last_name').strip()
        student_obj.email = request.POST.get('email')
        student_obj.phone_no = request.POST.get('phone_no')
        student_obj.dob = request.POST.get('dob')
        student_obj.gender = request.POST.get('gender')
        student_obj.guardian_name = request.POST.get('guardian_name')
        student_obj.guardian_phone_no = request.POST.get('guardian_phone_no')

        educational_qualification = request.POST.get('educational_qualification')

        if educational_qualification:
            student_obj.educational_qualification = educational_qualification

        student_obj.address = request.POST.get('address')

        if request.FILES.get('photo'):
            student_obj.photo = request.FILES.get('photo')

        if request.FILES.get('id_proof'):
            student_obj.id_proof = request.FILES.get('id_proof')

        if request.FILES.get('certificate'):
            student_obj.certificate = request.FILES.get('certificate')

        student_obj.save()

        course_id = request.POST.get('course_name')

        if course_id:
            admission.course_name_id = course_id

        admission.status = "enrolled"
        admission.save()

        batch_id = request.POST.get('batch')

        if batch_id:
            enrollment.batch_id = batch_id

        enrollment.start_date = request.POST.get('start_date')
        enrollment.save()

        messages.success(
            request,
            " Student details updated successfully"
        )

        return redirect('student_list')

    return render(request, "admissions/edit_student.html", {
        'student': student_obj,
        'admission': admission,
        'enrollment': enrollment,
        'courses': courses,
        'batches': batches
    })


@login_required(login_url='staff_login')
def delete_student(request, id):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to delete students.")
        return redirect('student_list')

    student_obj = get_object_or_404(Student, id=id)
    student_obj.delete()

    messages.success(request, "Student deleted successfully")

    return redirect('student_list')


@login_required(login_url='staff_login')
def search_students(request):
    if not (is_admin_manager(request) or is_hr(request) or is_trainer(request)):
        messages.error(request, "You do not have permission to search students.")
        return redirect('staff_dashboard')

    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = get_role(request)

    selected_batch = get_selected_batch(request)

    students = Student.objects.prefetch_related(
        'admissions__course_name',
        'admissions__enrollment'
    )

    if my_role == 'Trainer':
        students = students.filter(
            admissions__enrollment__batch__trainer=my_staff
        )

    student_filter = StudentFilter(
        request.GET,
        queryset=students
    )

    filtered_students = student_filter.qs.distinct().order_by('-id')
    format = request.GET.get('format')

    if format == 'excel':
        wb = Workbook()
        ws = wb.active
        ws.title = "Search Results"

        headers = [
            "Student", "Student ID", "Course",
            "Status", "Fee", "Joined"
        ]

        ws.append(headers)

        header_fill = PatternFill(
            start_color="FFC000",
            end_color="FFC000",
            fill_type="solid"
        )

        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        ids_param = request.GET.get('ids')

        if ids_param:
            selected_ids = [
                i for i in ids_param.split(',')
                if i.strip().isdigit()
            ]
            export_students = filtered_students.filter(
                id__in=selected_ids
            )
        else:
            export_students = filtered_students

        for student_obj in export_students:
            for admission in student_obj.admissions.all():
                enrollment = getattr(admission, 'enrollment', None)

                if student_obj.pending_amount() <= 0:
                    fee_status = "Paid"
                elif student_obj.total_paid() > 0:
                    fee_status = "Partial"
                else:
                    fee_status = "Pending"

                ws.append([
                    f"{student_obj.first_name} {student_obj.last_name}",
                    f"STU{student_obj.id}",
                    str(admission.course_name)
                    if admission.course_name else "-",
                    admission.status,
                    fee_status,
                    str(enrollment.start_date)
                    if enrollment else "-",
                ])

        for col, width in {
            'A': 25, 'B': 12, 'C': 20,
            'D': 15, 'E': 12, 'F': 15
        }.items():
            ws.column_dimensions[col].width = width

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

        response['Content-Disposition'] = (
            'attachment; filename=search_results.xlsx'
        )

        wb.save(response)
        return response

    try:
        per_page = int(request.GET.get('per_page', 10))

        if per_page not in (10, 25, 50, 100):
            per_page = 10

    except (TypeError, ValueError):
        per_page = 10

    paginator = Paginator(filtered_students, per_page)

    page_obj = paginator.get_page(
        request.GET.get('page', 1)
    )

    querydict = request.GET.copy()
    querydict.pop('page', None)
    querydict.pop('format', None)

    base_query = querydict.urlencode()

    batches_qs = Batch.objects.all()

    if my_role == 'Trainer':
        batches_qs = batches_qs.filter(trainer=my_staff)

    return render(request, "admissions/search_students.html", {
        'filter': student_filter,
        'page_obj': page_obj,
        'courses': Course.objects.all(),
        'batches': batches_qs,
        'per_page': per_page,
        'base_query': base_query,
        'selected_batch': selected_batch,
    })


@login_required(login_url='staff_login')
def view_student(request, id):
    my_staff = getattr(request.user, 'staff_profile', None)
    my_role = get_role(request)

    if not (
        is_admin_manager(request)
        or is_hr(request)
        or is_trainer(request)
    ):
        messages.error(request, "You do not have permission to view students.")
        return redirect('staff_dashboard')

    student_obj = get_object_or_404(
        Student.objects.prefetch_related(
            'payments',
            'admissions__course_name',
            'admissions__enrollment'
        ),
        id=id
    )

    if my_role == 'Trainer':
        if not student_obj.admissions.filter(
            enrollment__batch__trainer=my_staff
        ).exists():
            raise PermissionDenied

        return render(request, "admissions/view_student_trainer.html", {
            'student': student_obj,
        })

    admission = student_obj.admissions.first()
    enrollment = admission.enrollment if admission else None
    payments = student_obj.payments.all().order_by('-date')

    return render(request, "admissions/view_student.html", {
        'student': student_obj,
        'admission': admission,
        'enrollment': enrollment,
        'payments': payments,
        'total_paid': student_obj.total_paid(),
        'pending': student_obj.pending_amount(),
    })


def check_email(request):
    email = request.GET.get('email')
    exclude_id = request.GET.get('exclude_id')

    qs = Student.objects.filter(email=email)

    if exclude_id:
        qs = qs.exclude(pk=exclude_id)

    return JsonResponse({
        'exists': qs.exists()
    })


def check_phone(request):
    phone = request.GET.get('phone')
    exclude_id = request.GET.get('exclude_id')

    qs = Student.objects.filter(phone_no=phone)
    guardian_qs = Student.objects.filter(guardian_phone_no=phone)

    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
        guardian_qs = guardian_qs.exclude(pk=exclude_id)

    return JsonResponse({
        'exists': qs.exists(),
        'guardian_exists': guardian_qs.exists()
    })


@login_required(login_url='staff_login')
def preview_receipt(request, pk):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to view receipts.")
        return redirect('staff_dashboard')

    payment = get_object_or_404(Payment, id=pk)
    admission = payment.student.admissions.first()

    enrollment = (
        admission.enrollment
        if admission and hasattr(admission, 'enrollment')
        else None
    )

    return render(request, "admissions/preview_receipt.html", {
        'payment': payment,
        'student_name': (
            f"{payment.student.first_name} "
            f"{payment.student.last_name}"
        ),
        'phone': payment.student.phone_no,
        'email': payment.student.email,
        'course': admission.course_name if admission else "-",
        'batch': enrollment.batch if enrollment else "-",
        'total_fee': payment.student.total_fee(),
        'total_paid': payment.student.total_paid(),
        'pending': payment.student.pending_amount(),
        'today': timezone.localdate(),
    })


@login_required(login_url='staff_login')
def receipt_pdf(request, pk):
    if not is_admin_manager(request):
        messages.error(request, "You do not have permission to view receipts.")
        return redirect('staff_dashboard')

    payment = get_object_or_404(Payment, id=pk)
    admission = payment.student.admissions.first()

    enrollment = (
        admission.enrollment
        if admission and hasattr(admission, "enrollment")
        else None
    )

    return render(request, "admissions/fee_receipt.html", {
        "payment": payment,
        "student_name": (
            f"{payment.student.first_name} "
            f"{payment.student.last_name}"
        ),
        "phone": payment.student.phone_no,
        "email": payment.student.email,
        "course": admission.course_name if admission else "-",
        "batch": enrollment.batch if enrollment else "-",
        "total_fee": payment.student.total_fee(),
        "total_paid": payment.student.total_paid(),
        "pending": payment.student.pending_amount(),
        "today": timezone.localdate(),
    })