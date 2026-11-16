from django.urls import path
from .views import *

app_name = 'leads'

urlpatterns = [
    path('', lead_capture_list, name='lead_capture_list'),
    path('lead/<int:id>/', lead_capture_details, name='lead_capture_details'),
    path('create/', lead_capture_create, name='lead_capture_create'),
    path('lead/<int:id>/edit',lead_capture_update, name='lead_capture_update'),
    # path('lead/<int:id>/delete',lead_capture_delete, name='lead_capture_delete'),
    path('pipeline/',lead_pipeline_view, name='lead_pipeline_view'),
    path('pipeline/export/', export_leads_csv, name='export_leads_csv'),
    path('report/', lead_conversion_report, name='lead_conversion_report'),
    path('followup/', followup_shedule, name='followup_shedule'),
    path('followup/<int:id>/complete/',mark_followup_completed,name='mark_followup_completed'),
    path('call_logs/', call_log_view, name='call_logs'),
    path('call_logs/search-lead/', search_lead_by_name, name='search_lead_by_name'),
    path('call_logs/contact/<int:log_id>/', contact_calls, name='contact_calls'),
    path('delete/<int:id>/', delete_call_log, name='delete_call'),
    path('check-lead/', check_lead_exists, name='check_lead_exists'),
    path('call-history/',call_history,name='call_history'),
    path('lead/<int:id>/download/', lead_capture_download_pdf, name='lead_capture_download_pdf'),
    path('target/', lead_capture_target, name='lead_capture_target'),
    path('target/assign/', lead_capture_target_assign, name='lead_capture_target_assign'),
    path('target/<int:pk>/update/', lead_capture_target_update, name='lead_capture_target_update'),
    path('target/<int:pk>/delete/', lead_capture_target_delete, name='lead_capture_target_delete'),
    path('target/<int:pk>/progress/', lead_capture_target_progress, name='lead_capture_target_progress'),
    path('lead-capture-target/my-target/',my_lead_capture_target, name='my_lead_capture_target'),
]