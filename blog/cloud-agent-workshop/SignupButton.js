import React, {useState} from 'react';
import SignupDialog from './SignupDialog';

export default function SignupButton({className = ''}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`button ${className}`} type="button" onClick={() => setOpen(true)}>
        Sign up <span aria-hidden="true">↗</span>
      </button>
      <SignupDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
