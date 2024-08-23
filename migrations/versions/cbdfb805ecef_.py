"""empty message

Revision ID: cbdfb805ecef
Revises: f4a557e688b1
Create Date: 2024-08-23 09:46:27.308118

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cbdfb805ecef'
down_revision = 'f4a557e688b1'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('username', sa.String(length=20), nullable=True))
        batch_op.create_unique_constraint(None, ['username'])

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='unique')
        batch_op.drop_column('username')

    # ### end Alembic commands ###
