from django.core.management.base import BaseCommand
from csc_crm.apps.staff.models import Staff
import re


class Command(BaseCommand):
    help = "Clean Staff phone numbers to 10-digit Indian mobile numbers"

    def clean_phone(self, value):
        if not value:
            return value

        # Remove spaces, hyphens, brackets, etc.
        digits = re.sub(r"\D", "", str(value))

        # Convert +91XXXXXXXXXX / 91XXXXXXXXXX to XXXXXXXXXX
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]

        return digits

    def handle(self, *args, **options):
        updated = 0
        skipped = 0

        staffs = Staff.objects.all()

        for staff in staffs:
            old_phone = staff.phone
            old_emergency = staff.emergency_contact_phone

            new_phone = self.clean_phone(old_phone)
            new_emergency = self.clean_phone(old_emergency)

            # Validate phone
            if new_phone and len(new_phone) != 10:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped Staff ID {staff.id}: "
                        f"invalid phone '{old_phone}'"
                    )
                )
                skipped += 1
                continue

            # Validate emergency phone if present
            if new_emergency and len(new_emergency) != 10:
                self.stdout.write(
                    self.style.WARNING(
                        f"Skipped Staff ID {staff.id}: "
                        f"invalid emergency phone '{old_emergency}'"
                    )
                )
                skipped += 1
                continue

            # Check duplicate phone numbers
            if new_phone and new_phone != old_phone:
                duplicate = Staff.objects.filter(
                    phone=new_phone
                ).exclude(pk=staff.pk).exists()

                if duplicate:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipped Staff ID {staff.id}: "
                            f"duplicate phone '{new_phone}'"
                        )
                    )
                    skipped += 1
                    continue

            changed = False

            if new_phone != old_phone:
                staff.phone = new_phone
                changed = True

            if new_emergency != old_emergency:
                staff.emergency_contact_phone = new_emergency
                changed = True

            if changed:
                staff.save(
                    update_fields=[
                        "phone",
                        "emergency_contact_phone"
                    ]
                )

                updated += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated Staff ID {staff.id}"
                    )
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Completed. Updated: {updated}, Skipped: {skipped}"
            )
        )
        