import database from '../../config/database.js';
import { logger } from '../../config/logger.js';

export interface RoomCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  sort_order: number;
}

export class CategoryService {
  async getAllCategories(): Promise<RoomCategory[]> {
    const result = await database.query(
      'SELECT * FROM room_categories WHERE is_active = true ORDER BY sort_order ASC'
    );
    return result.rows;
  }

  async getCategoryById(id: number): Promise<RoomCategory | null> {
    const result = await database.query(
      'SELECT * FROM room_categories WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getCategoryBySlug(slug: string): Promise<RoomCategory | null> {
    const result = await database.query(
      'SELECT * FROM room_categories WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  async createCategory(data: Partial<RoomCategory>): Promise<RoomCategory> {
    const result = await database.query(
      `INSERT INTO room_categories (name, slug, description, icon, color, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.slug,
        data.description,
        data.icon,
        data.color,
        data.sort_order || 0,
      ]
    );
    logger.info({ categoryId: result.rows[0].id }, 'Category created');
    return result.rows[0];
  }

  async updateCategory(id: number, data: Partial<RoomCategory>): Promise<RoomCategory> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.slug) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(data.slug);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.icon) {
      fields.push(`icon = $${paramIndex++}`);
      values.push(data.icon);
    }
    if (data.color) {
      fields.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }
    if (data.sort_order !== undefined) {
      fields.push(`sort_order = $${paramIndex++}`);
      values.push(data.sort_order);
    }

    if (fields.length === 0) {
      return this.getCategoryById(id);
    }

    values.push(id);
    const result = await database.query(
      `UPDATE room_categories SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async deleteCategory(id: number): Promise<void> {
    await database.query('DELETE FROM room_categories WHERE id = $1', [id]);
    logger.info({ categoryId: id }, 'Category deleted');
  }
}

export const categoryService = new CategoryService();
export default categoryService;
