from datetime import date

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from csc_crm.apps.staff.models import Staff, StaffRole, Department


class Command(BaseCommand):
    help = "Create or update Admin superuser and staff profile"

    def handle(self, *args, **kwargs):

        # -----------------------------------
        # Admin Login Details
        # -----------------------------------
        username = "EMP001"
        password = "Admin@12345"
        email = "admin@cscCrm.com"

        # -----------------------------------
        # Create / Update Django User
        # -----------------------------------
        user, user_created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
            },
        )

        # Always make sure the existing user
        # has superuser permissions
        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True

        # Reset password so the configured password works
        user.set_password(password)
        user.save()

        if user_created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"User {username} created successfully!"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"User {username} updated successfully!"
                )
            )

        # -----------------------------------
        # Create / Get Admin Role
        # -----------------------------------
        admin_role, role_created = StaffRole.objects.get_or_create(
            role_name="Admin",
            defaults={
                "description": "System Administrator",
                "can_manage_leads": True,
                "can_manage_staff": True,
                "can_view_reports": True,
                "can_mark_attendance": True,
            },
        )

        # Make sure permissions are enabled
        # even if the role already existed
        admin_role.description = "System Administrator"
        admin_role.can_manage_leads = True
        admin_role.can_manage_staff = True
        admin_role.can_view_reports = True
        admin_role.can_mark_attendance = True
        admin_role.save()

        # -----------------------------------
        # Create / Get Management Department
        # -----------------------------------
        mgmt_dept, dept_created = Department.objects.get_or_create(
            dept_name="Management",
            defaults={
                "description": "Management Department",
            },
        )

        # -----------------------------------
        # Create / Update Staff
        # -----------------------------------
        staff, staff_created = Staff.objects.get_or_create(
            employee_id=username,
            defaults={
                "first_name": "Senthil",
                "last_name": "V",
                "email": email,
                "phone": "6380885757",
                "role": admin_role,
                "department": mgmt_dept,
                "status": "active",
                "date_of_joining": date.today(),
                "user": user,
            },
        )

        # Update existing Staff record also
        staff.first_name = "Senthil"
        staff.last_name = "V"
        staff.email = email
        staff.phone = "6380885757"
        staff.role = admin_role
        staff.department = mgmt_dept
        staff.status = "active"
        staff.user = user

        if not staff.date_of_joining:
            staff.date_of_joining = date.today()

        staff.save()

        if staff_created:
            self.stdout.write(
                self.style.SUCCESS(
                    "Admin Staff created successfully!"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "Admin Staff updated successfully!"
                )
            )

        # -----------------------------------
        # Final Confirmation
        # -----------------------------------
        self.stdout.write(
            self.style.SUCCESS(
                "========================================"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Admin setup completed successfully!"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Username : {username}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Password : Admin@12345"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Superuser: True"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Staff    : True"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "========================================"
            )
        )