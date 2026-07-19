Nothing to configure — the module is installed automatically (`auto_install`)
as soon as `web` is present.

Open any list or form view and run a server action, either from the cog
("Action") menu or from a button. A confirmation dialog naming the action
appears before it runs:

- Confirm: the server action executes exactly as it would without this
  module installed.
- Cancel: the server action is not executed, no record is changed, and no
  error is raised.

Actions of any other type (`ir.actions.act_window`, `ir.actions.client`,
reports, ...) run without any extra dialog.
