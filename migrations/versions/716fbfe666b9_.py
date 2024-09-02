"""empty message

Revision ID: 716fbfe666b9
Revises: b107c0f357f3
Create Date: 2024-09-02 10:52:34.236036

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '716fbfe666b9'
down_revision = 'b107c0f357f3'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('review', schema=None) as batch_op:
        batch_op.alter_column('user_id',
               existing_type=sa.INTEGER(),
               nullable=True)
        batch_op.drop_constraint('review_user_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(None, 'user', ['user_id'], ['id'], ondelete='CASCADE')

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('review', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key('review_user_id_fkey', 'user', ['user_id'], ['id'])
        batch_op.alter_column('user_id',
               existing_type=sa.INTEGER(),
               nullable=False)

    # ### end Alembic commands ###
