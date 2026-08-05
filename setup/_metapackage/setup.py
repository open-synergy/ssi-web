import setuptools

with open('VERSION.txt', 'r') as f:
    version = f.read().strip()

setuptools.setup(
    name="odoo14-addons-open-synergy-ssi-web",
    description="Meta package for open-synergy-ssi-web Odoo addons",
    version=version,
    install_requires=[
        'odoo14-addon-ssi_web_chatwoot',
        'odoo14-addon-ssi_web_clear_all_filter',
        'odoo14-addon-ssi_web_edit_attachment_name',
        'odoo14-addon-ssi_web_gantt',
        'odoo14-addon-ssi_web_hierarchy_view',
        'odoo14-addon-ssi_web_inbox',
        'odoo14-addon-ssi_web_login',
        'odoo14-addon-ssi_web_permanent_menu_icon',
        'odoo14-addon-ssi_web_server_action_confirmation',
        'odoo14-addon-ssi_web_show_hide_password',
        'odoo14-addon-ssi_web_sticky_list_header',
        'odoo14-addon-ssi_web_widget_ace_git',
        'odoo14-addon-ssi_web_widget_copy_content',
        'odoo14-addon-ssi_web_widget_csv_table',
        'odoo14-addon-ssi_web_widget_json',
        'odoo14-addon-ssi_web_widget_many2onereference_clickable',
        'odoo14-addon-ssi_web_widget_rjsf',
        'odoo14-addon-ssi_web_widget_whatsapp',
        'odoo14-addon-ssi_web_widget_x2m_excel_download',
        'odoo14-addon-ssi_web_x2m_search',
    ],
    classifiers=[
        'Programming Language :: Python',
        'Framework :: Odoo',
        'Framework :: Odoo :: 14.0',
    ]
)
