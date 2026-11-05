from django.db import migrations, models
import django.core.validators


def clean_phone_numbers(apps, schema_editor):
    Student = apps.get_model('admissions', 'Student')

    for student in Student.objects.all():
        changed = False

        for field in ['phone_no', 'guardian_phone_no']:
            value = getattr(student, field)

            if value:
                # Remove spaces, +, -, etc.
                digits = ''.join(ch for ch in value if ch.isdigit())

                # Remove country code 91 if present
                if len(digits) == 12 and digits.startswith('91'):
                    digits = digits[2:]

                # If still longer than 10, keep the last 10 digits
                elif len(digits) > 10:
                    digits = digits[-10:]

                if len(digits) == 10:
                    setattr(student, field, digits)
                    changed = True

        if changed:
            student.save(update_fields=['phone_no', 'guardian_phone_no'])


class Migration(migrations.Migration):

    dependencies = [
        ('admissions', '0008_student_educational_qualification'),
    ]

    operations = [

        # Clean existing database phone numbers first
        migrations.RunPython(
            clean_phone_numbers,
            reverse_code=migrations.RunPython.noop,
        ),

        # Correct 10-digit phone number format
        migrations.AlterField(
            model_name='student',
            name='guardian_phone_no',
            field=models.CharField(
                max_length=10,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message='Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.',
                        regex=r'^[6-9]\d{9}$'
                    )
                ]
            ),
        ),

        migrations.AlterField(
            model_name='student',
            name='phone_no',
            field=models.CharField(
                max_length=10,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message='Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.',
                        regex=r'^[6-9]\d{9}$'
                    )
                ]
            ),
        ),
    ]