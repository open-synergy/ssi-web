import setuptools

with open('VERSION.txt', 'r') as f:
    version = f.read().strip()

setuptools.setup(
    name="odoo14-addons-open-synergy-ssi-web",
    description="Meta package for open-synergy-ssi-web Odoo addons",
    version=version,
    install_requires=[
        'odoo14-addon-ssi_web_clear_all_filter',
        'odoo14-addon-ssi_web_widget_many2onereference_clickable',
    ],
    classifiers=[
        'Programming Language :: Python',
        'Framework :: Odoo',
        'Framework :: Odoo :: 14.0',
    ]
)
