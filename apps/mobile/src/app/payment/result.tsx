import { Redirect, useLocalSearchParams } from 'expo-router';

// Wompi sends the owner here after paying: pawie://payment/result?bookingId=…&paymentId=…
// (on the web, <web>/payment/result with the same parameters).
// The payment is confirmed by its webhook, so this only opens the booking, which keeps asking.
export default function PaymentResultScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  return <Redirect href={bookingId ? `/reservas/${bookingId}?returned=1` : '/visitas'} />;
}
