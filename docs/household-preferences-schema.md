# Household Preferences Schema

Create a Google Sheet tab named `Household_Preferences`.

## Columns

- `preference_type`
- `keyword`
- `weight`
- `enabled`
- `note`

## Rules

- `preference_type`
  Use values like `favorite`, `dislike`, `prefer`, or `avoid`.
- `keyword`
  A Thai keyword or phrase to match against the menu name, style, ingredients, or note.
- `weight`
  Optional numeric strength. Default is `3` if left blank.
- `enabled`
  Use `yes` to turn the row on. Blank also counts as enabled.
- `note`
  Optional human note.

## Example Rows

| preference_type | keyword | weight | enabled | note |
| --- | --- | --- | --- | --- |
| favorite | ตำปลาร้า | 5 | yes | เมนูโปรด |
| favorite | ข้าวไข่ดาวสองฟอง | 5 | yes | เมนูโปรด |
| favorite | ผัดผักบุ้ง | 4 | yes | เมนูโปรด |
| favorite | แซนด์วิชเนื้อชีส | 5 | yes | เมนูโปรด |
| dislike | เผ็ดมาก | 4 | yes | ไม่กินเผ็ดจัด |
