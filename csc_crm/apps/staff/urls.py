from django.urls import path
from .views import *

urlpatterns = [

    # LOGIN / LOGOUT
    path('login/', staff_login, name='staff_login'),
    path('logout/', staff_logout, name='staff_logout'),

    # Dashboard
    path('', staff_dashboard, name = 'staff_dashboard'),

    path('management/', staff_management, name='staff_management'),
    path('add/', add_staff, name='add_staff'),
    path('<int:id>/edit/', edit_staff, name='edit_staff'),
    path('<int:id>/delete/', delete_staff, name='delete_staff'),
    path('<int:id>/quick-edit', quick_edit_staff, name='quick_edit_staff'),
    path('export/', export_staff, name='export_staff'), 
    # STAFF OVERVIEW URLS
    path('overview/<int:staff_id>', overview, name='overview'),
    path('overview/<int:id>/export/', staff_export, name='staff_export'),
    path('overview/<int:staff_id>/leads/', staff_assigned_leads, name='staff_assigned_leads'),
    # STAFF ATTENDANCE
    path('attendance/export/<int:id>/', export_attendance, name='export_attendance'),
    path('attendance/<int:id>/', attendance_page, name='attendance'),
    path('staff-checkin/<int:id>/', staff_checkin, name='staff_checkin'),
    

    # VALIDATION (EMAIL)
    path('check-email/', check_email, name='check_email'),
    path('check-employee-id/', check_employee_id, name='check_employee_id'),
    path('check-phone/', check_phone, name='check_phone'),

    # DOCUMENT URLS
    path('<int:staff_id>/documents/', staff_documents, name='staff_documents'),
    path('documents/<int:doc_id>/delete/', delete_document, name='delete_document'),
    path('documents/<int:doc_id>/status/', update_document_status, name='update_document_status'),

    
    # MY PROFILE
    path('<int:staff_id>/profile/', staff_profile, name='staff_profile'),
    
]