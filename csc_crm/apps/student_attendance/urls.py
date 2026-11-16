from django.urls import path, include
from . import views 
from rest_framework.routers import DefaultRouter
from .views import (BatchViewSet,attendance_history_page,batches_page,mark_attendance_page,bulk_attendance)

#================ DRF ROUTER - BATCH CRUD API ==================#
router = DefaultRouter()
router.register(r'batches', BatchViewSet)


urlpatterns = [
    #=============================== BATCHES =============================#
    path('batches-page/',batches_page,name='batches_page'),
    path('batch-preview/<int:batch_id>/',views.batch_preview,name='batch_preview'),
    path('get-batches/', views.get_batches_by_course, name='get-batches'),
    path('course-duration/<int:course_id>/',views.get_course_duration,name='course-duration'),

    #======================= MARK ATTENDANCE ============================#
    path('mark-attendance/<int:batch_id>/',mark_attendance_page,name='mark_attendance_page'),
    path('attendance/bulk/',bulk_attendance,name='bulk_attendance'),

    #================ ATTENDANCE HISTORY & EXPORT ==================#
    path('attendance-history/',attendance_history_page,name='attendance_history'),
    path('attendance-history/detail/<int:batch_id>/<str:date>/',views.attendance_history_detail,name='attendance_history_detail'),
    path('attendance-export/', views.attendance_export, name='attendance_export'),
    path("student-attendance-summary/<int:student_id>/",views.student_attendance_summary,name="student_attendance_summary"),

    #================ DASHBOARD ==================#
    path("dashboard/",views.dashboard,name="dashboard"),
    path("dashboard-api/",views.dashboard_api,name="dashboard_api"),

    #================ ABSENT TRACKER ==================#
    path('absent-tracker/',views.absent_tracker,name='absent_tracker'),
    path('mark-notification/<int:enrollment_id>/',views.mark_notification_sent,name='mark_notification_sent'),
    path('get-admin-notes/<int:tracker_id>/',views.get_admin_notes,name='get_admin_notes'),
    path("save-admin-notes/",views.save_admin_notes,name="save_admin_notes"),

    #================ LOW ATTENDANCE ALERTS ==================#
    path('low-attendance-alerts/',views.low_attendance_alerts,name='low_attendance_alerts'),
    path('low-attendance/export/',views.low_attendance_export,name='low_attendance_export'),

    #================ NOTIFICATIONS - EMAIL / SMS ==================#
    path('send-sms-notification/<int:enrollment_id>/',views.send_sms_notification,name='send_sms_notification'),
    path('send-low-attendance-email/<int:enrollment_id>/',views.send_low_attendance_email,name='send_low_attendance_email'),
    path('send-email-all/',views.send_email_all,name='send_email_all'),
    path('send-sms-all/',views.send_sms_all,name='send_sms_all'),
    path('send-bulk-notification/',views.send_bulk_notification,name='send_bulk_notification'),
    path('send-monthly-report/',views.send_monthly_report,name='send_monthly_report'),

    #================ REPORTS & ANALYTICS ==================#
    path('reports/',views.reports,name='reports'),
    path('analytics-pdf/',views.analytics_pdf,name='analytics_pdf'),
    path('analytics-excel/',views.analytics_excel,name='analytics_excel'),
    path('report-pdf/',views.report_pdf,name='report_pdf'),
    path('report-excel/',views.report_excel,name='report_excel'),

    #================ Trainer-Schedule ==================#
    path('schedule/', views.schedule_page, name='schedule_page'),
    path('schedule/create/', views.create_schedule, name='create_schedule'),
   
    path('schedule/export/', views.export_schedule, name='export_schedule'),
    path('schedule/status/<int:schedule_id>/', views.update_schedule_status, name='update_schedule_status'),

    #================ BATCH CRUD API (ROUTER) ==================#
    path('',include(router.urls)),
]