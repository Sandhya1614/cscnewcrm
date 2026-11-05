from rest_framework import serializers
from django.utils import timezone
from .models import (Batch, Attendance)


#================ BATCH SERIALIZER (LIST/CREATE/UPDATE) ==================#
class BatchSerializer(serializers.ModelSerializer):

    trainer_name = serializers.SerializerMethodField()
    is_marked = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    course_name = serializers.CharField(source='course.course_name', read_only=True)
    present_count = serializers.SerializerMethodField()
    absent_count = serializers.SerializerMethodField()
    display_status = serializers.CharField(read_only=True)

    class Meta:
        model = Batch
        fields = [
            'id', 'batch_name', 'course', 'course_name', 'timing', 'start_time', 'end_time',
            'student_count', 'present_count', 'absent_count', 'trainer', 'trainer_name',
            'is_marked', 'start_date', 'end_date', 'created_at', 'updated_at', 'status',
            'display_status',
        ]

    #================ VALIDATION - NAME UNIQUENESS, START DATE, TRAINER OVERLAP ==================#
    def validate(self, data):

        batch_name = data.get("batch_name")
        trainer = data.get('trainer')
        timing = data.get('timing')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        today = timezone.now().date()

        if batch_name:
            queryset = Batch.objects.filter(batch_name__iexact=batch_name)

            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError({"batch_name": "Batch name already exists."})

        if self.instance is None and start_date and start_date < today:
            raise serializers.ValidationError({"start_date": "Start cannot be a past date."})

        if trainer and start_date and end_date:
            overlapping_batches = Batch.objects.filter(
                trainer=trainer, timing=timing,
                start_date__lte=end_date, end_date__gte=start_date
            )

            if self.instance:
                overlapping_batches = overlapping_batches.exclude(pk=self.instance.pk)

            if overlapping_batches.exists():
                raise serializers.ValidationError({"trainer": [
                    "Trainer already assigned to another batch during this period."
                ]})

        return data

    #================ COMPUTED FIELD - STUDENT COUNT ==================#
    def get_student_count(self, obj):
        return obj.student_count

    #================ COMPUTED FIELD - TRAINER DISPLAY NAME ==================#
    def get_trainer_name(self, obj):
        if obj.trainer:
            return f"{obj.trainer.first_name} {obj.trainer.last_name}"
        return None

    #================ COMPUTED FIELD - TODAY'S PRESENT COUNT ==================#
    def get_present_count(self, obj):
        today = timezone.now().date()
        return Attendance.objects.filter(
            batch=obj, attendance_date=today, status__in=["Present", "Late"]
        ).count()

    #================ COMPUTED FIELD - TODAY'S ABSENT COUNT ==================#
    def get_absent_count(self, obj):
        today = timezone.now().date()
        return Attendance.objects.filter(
            batch=obj, attendance_date=today, status="Absent"
        ).count()

    #================ COMPUTED FIELD - TODAY'S ATTENDANCE MARKED STATUS ==================#
    def get_is_marked(self, obj):
        return Attendance.objects.filter(
            batch=obj, attendance_date=timezone.now().date()
        ).exists()