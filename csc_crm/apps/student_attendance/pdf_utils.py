from reportlab.lib import colors
from reportlab.platypus import TableStyle

#================ PDF DEFAULT TABLE STYLE (HEADER + ZEBRA ROWS) ==================#
def get_default_table_style(header_color="#1E40AF", zebra=True):
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_color)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if zebra:
        style.append(('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F3F4F6')]))
    return TableStyle(style)