import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';

import { Input, type InputProps } from './Input';

export type FormInputProps<T extends FieldValues> = Omit<
  InputProps,
  'value' | 'onChangeText' | 'onBlur' | 'error'
> & {
  control: Control<T>;
  name: Path<T>;
  /** Reformats what the person types, such as maskDate. */
  mask?: (text: string) => string;
};

/** An Input tied to a react-hook-form field of text, with its error. */
export function FormInput<T extends FieldValues>({
  control,
  name,
  mask,
  ...props
}: FormInputProps<T>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <Input
      {...props}
      value={field.value}
      onChangeText={(text) => field.onChange(mask ? mask(text) : text)}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  );
}
