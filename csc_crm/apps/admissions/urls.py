from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('student/',views.student,name='student'),
    path('fee_dashboard/',views.fee_dashboard,name='fee_dashboard'),
    path("search-student-by-name/", views.search_student_by_name, name="search_student_by_name"),
    path("payment-history/", views.payment_history_all, name="payment_history_all"),
    path('generate_receipt/<int:pk>/', views.generate_receipt, name='generate_receipt'),
    path('batches/', views.batch_list, name='batch_list'),
    path('student_list/',views.student_list,name='student_list'),
    path('search-batches/', views.search_batch_list, name='search_batch_list'),
    path("receipt_pdf/<int:pk>/",views.receipt_pdf,name="receipt_pdf",),
    path('edit_student/<int:id>/',views.edit_student,name='edit_student'),
    path('delete_student/<int:id>/',views.delete_student,name='delete_student'),
    path('search_students/',views.search_students,name='search_students'),
    path('view_student/<int:id>/',views.view_student,name='view_student'),
    path('check-email/',views.check_email,name='check_email'),
    path('check-phone/',views.check_phone,name='check_phone'),
    path('search-lead/', views.search_lead_for_admission, name='search_lead_for_admission'),
    path('preview_receipt/<int:pk>/', views.preview_receipt, name='preview_receipt'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)