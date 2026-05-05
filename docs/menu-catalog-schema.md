# Menu Catalog Schema

Create a Google Sheet tab named `Menu_Catalog`.

If you want starter rows you can paste immediately, use
[menu-catalog-starter.tsv](/Users/apple/projects/maliwan/docs/menu-catalog-starter.tsv:1).

## Columns

- `menu_name`
- `required_items`
- `optional_items`
- `style`
- `spicy_level`
- `difficulty`
- `time_minutes`
- `preferred_for_house`
- `avoid_if`
- `note`

## Rules

- `required_items`
  Comma-separated keywords that must exist in inventory.
- `optional_items`
  Comma-separated keywords that improve the menu score.
- `preferred_for_house`
  Use `yes` for menus the household likes.
- `difficulty`
  Suggested values: `easy`, `medium`, `hard`

## Example Rows

| menu_name | required_items | optional_items | style | spicy_level | difficulty | time_minutes | preferred_for_house | avoid_if | note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ต้มจืดเต้าหู้หมูสับ | เต้าหู้,หมูสับ | ต้นหอม,ผักกาด | เมนูน้ำ | mild | easy | 20 | yes |  | เมนูบ้านๆ |
| ไข่เจียวหมูสับ | ไข่,หมูสับ | หอมใหญ่ | ทอด | mild | easy | 10 | yes |  | ทำเร็ว |
| เต้าหู้ผัดไข่ | เต้าหู้,ไข่ | ต้นหอม | ผัด | mild | easy | 15 | yes |  | ใช้วัตถุดิบน้อย |
| น้ำพริกปลาทู | ปลาทู | พริก,หอมแดง,มะนาว | น้ำพริก | medium | medium | 20 |  |  | |
