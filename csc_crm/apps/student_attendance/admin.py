from django.contrib import admin

from .models import (
    Batch,
)





@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):

    list_display = (
        'batch_name',
        'course',
        'trainer',
        'student_count'
    )


