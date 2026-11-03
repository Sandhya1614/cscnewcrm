from django import forms
from .models import Batch
from csc_crm.apps.staff.models import TrainerSchedule, Staff
from django.utils import timezone

#================ BATCH CREATE/EDIT FORM ==================#
class BatchForm(forms.ModelForm):

    class Meta:
        model = Batch
        fields = ['batch_name','course','timing','start_time','end_time','start_date','end_date','trainer',]

        widgets = {
            'batch_name': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Eg: June 2026',
            }),

            'course': forms.Select(attrs={
                'class': 'form-select'
            }),

            'timing': forms.Select(attrs={
                'class': 'form-control'
            }),

            'start_date':forms.DateInput(attrs={
                'class':'form-control',
                'type':'date',
                'required':True,
            }),

            'end_date':forms.DateInput(attrs={
                'class':'form-control',
                'type':'date',
                'required':True,
                'readonly': True,
            }),

            'start_time': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),

            'end_time': forms.TimeInput(attrs={
                'class': 'form-control',
                'type': 'time'
            }),

            'trainer': forms.Select(attrs={
                'class': 'form-select',
            }),
        }

    #================ INIT - TRAINER DROPDOWN (ACTIVE TRAINERS ONLY) ==================#
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields['trainer'].queryset = Staff.objects.filter(
            role__role_name="Trainer",
            status="active"
        ).order_by("first_name")


#================ TRAINER SCHEDULE FORM (ADMIN/MANAGER ONLY - ASSIGN TRAINER) ==================#
class TrainerScheduleForm(forms.ModelForm):

    class Meta:
        model = TrainerSchedule
        fields = ['staff', 'topic', 'date', 'time', 'type']   # status 

        widgets = {
            'staff': forms.Select(attrs={'class': 'sched-input', 'id': 'assignTrainer'}),
            'topic': forms.TextInput(attrs={'class': 'sched-input', 'placeholder': 'Enter topic', 'id': 'scheduleTopic'}),
            'date': forms.DateInput(attrs={'class': 'sched-input', 'type': 'date', 'id': 'scheduleDate'}),
            'time': forms.TimeInput(attrs={'class': 'sched-input', 'type': 'time', 'id': 'scheduleTime'}),
            'type': forms.Select(attrs={'class': 'sched-input', 'id': 'scheduleType'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['staff'].queryset = Staff.objects.filter(role__role_name='Trainer', status='active').order_by('first_name')
        self.fields['staff'].label = "Assign Trainer"
        self.fields['staff'].empty_label = "Select Trainer"
        for field in self.fields.values():
            field.required = True


    def clean_date(self):
        date = self.cleaned_data.get('date')
    
        if date and date < timezone.now().date():
            raise forms.ValidationError(
                    "Past dates are not allowed. Please select today or a future date."
                )
    
        return date