import { View, StyleSheet, TouchableOpacity, TextInput, Text, Alert, ActivityIndicator } from "react-native";
import { useState, useRef } from "react";
import { useSignUp, useSignIn } from "@clerk/clerk-expo";

export default function EmailVerification({ navigation, route }) {
  const { email, fromLogin } = route.params || {};
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  const inputRefs = useRef([]);

  const handleCodeChange = (text, index) => {
    if (text && !/^\d+$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join("");
    
    if (verificationCode.length !== 6) {
      Alert.alert("Error", "Please enter the complete 6-digit code");
      return;
    }

    if (!signUpLoaded && !signInLoaded) {
      Alert.alert("Error", "Please wait, loading...");
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔵 Attempting email verification...');
      console.log('Code:', verificationCode);
      console.log('Email:', email);
      console.log('From login:', fromLogin);

      // Try signUp verification first (for new registrations)
      if (signUp && signUpLoaded && !fromLogin) {
        try {
          console.log('Attempting signUp verification...');
          
          const result = await signUp.attemptEmailAddressVerification({
            code: verificationCode,
          });

          console.log('SignUp verification result:', result);
          console.log('Status:', result.status);

          if (result.status === 'complete') {
            console.log('✅ Email verified successfully!');
            console.log('Setting active session...');
            
            // Set active session - this will trigger Clerk webhook
            await setActiveSignUp({ 
              session: result.createdSessionId 
            });

            console.log('✅ Session activated');
            console.log('User will be saved to database via Clerk webhook');

            // Show success and navigate to Home
            Alert.alert(
              "Success!",
              "Email verified successfully! Welcome to Libot.",
              [{
                text: "OK",
                onPress: () => {
                  // Navigation will happen automatically via App.js
                  // because isSignedIn will now be true
                  console.log('User should now be redirected to Home');
                }
              }]
            );
            
            setIsLoading(false);
            return;
          } else {
            console.log('⚠️ Unexpected status:', result.status);
          }
        } catch (signUpError) {
          console.error('SignUp verification error:', signUpError);
          console.error('Error details:', JSON.stringify(signUpError, null, 2));
          
          const errorCode = signUpError.errors?.[0]?.code;
          const errorMessage = signUpError.errors?.[0]?.message;
          
          if (errorCode === 'form_code_incorrect') {
            Alert.alert("Invalid Code", "The verification code is incorrect. Please try again.");
            setCode(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
            setIsLoading(false);
            return;
          } else if (errorCode === 'verification_expired') {
            Alert.alert("Code Expired", "This verification code has expired. Please request a new one.");
            setCode(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
            setIsLoading(false);
            return;
          } else {
            Alert.alert("Verification Failed", errorMessage || "Unable to verify code. Please try again.");
            setCode(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
            setIsLoading(false);
            return;
          }
        }
      }

      // Try signIn verification (for login flow)
      if (signIn && signInLoaded && fromLogin) {
        try {
          console.log('Attempting signIn verification...');
          
          const result = await signIn.attemptFirstFactor({
            strategy: 'email_code',
            code: verificationCode,
          });

          console.log('SignIn verification result:', result);
          console.log('Status:', result.status);

          if (result.status === 'complete') {
            console.log('✅ Email verified successfully!');
            
            await setActiveSignIn({ 
              session: result.createdSessionId 
            });

            Alert.alert(
              "Success!",
              "Email verified! Welcome back.",
              [{
                text: "OK",
                onPress: () => {
                  console.log('User should now be redirected to Home');
                }
              }]
            );
            
            setIsLoading(false);
            return;
          }
        } catch (signInError) {
          console.error('SignIn verification error:', signInError);
          
          const errorCode = signInError.errors?.[0]?.code;
          const errorMessage = signInError.errors?.[0]?.message;
          
          if (errorCode === 'form_code_incorrect') {
            Alert.alert("Invalid Code", "The verification code is incorrect. Please try again.");
          } else {
            Alert.alert("Verification Failed", errorMessage || "Unable to verify code.");
          }
          
          setCode(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
          setIsLoading(false);
          return;
        }
      }

      // If we get here, verification failed
      Alert.alert("Verification Failed", "Unable to verify the code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      
    } catch (error) {
      console.error('❌ Unexpected verification error:', error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!signUpLoaded && !signInLoaded) {
      Alert.alert("Error", "Please wait, loading...");
      return;
    }

    setIsResending(true);
    
    try {
      console.log('🔵 Resending verification code...');
      
      // Resend for signUp
      if (signUp && signUpLoaded && !fromLogin) {
        await signUp.prepareEmailAddressVerification({ 
          strategy: 'email_code' 
        });
        
        Alert.alert(
          "Code Sent",
          `A new verification code has been sent to ${email}. Please check your email.`
        );
        
        setCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
      
      // Resend for signIn
      if (signIn && signInLoaded && fromLogin) {
        const emailFactor = signIn.supportedFirstFactors?.find(
          factor => factor.strategy === 'email_code'
        );

        if (emailFactor) {
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailFactor.emailAddressId,
          });
          
          Alert.alert(
            "Code Sent",
            `A new verification code has been sent to ${email}.`
          );
          
          setCode(["", "", "", "", "", ""]);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (error) {
      console.error('❌ Resend error:', error);
      Alert.alert("Error", "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>We've sent a 6-digit code to</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.hint}>Please check your inbox and spam folder</Text>
      </View>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={styles.codeInput}
            value={digit}
            onChangeText={(text) => handleCodeChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!isLoading && !isResending}
          />
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.verifyButton, (isLoading || isResending) && styles.verifyButtonDisabled]} 
          onPress={handleVerify}
          disabled={isLoading || isResending}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Email</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity 
          onPress={handleResendCode} 
          disabled={isLoading || isResending}
        >
          {isResending ? (
            <ActivityIndicator size="small" color="#6b4b45" />
          ) : (
            <Text style={styles.resendLink}>Resend</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.backContainer}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          disabled={isLoading || isResending}
        >
          <Text style={styles.backText}>← Back to {fromLogin ? 'Login' : 'Register'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f7cfc9",
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 60,
    marginTop: 60,
  },
  title: {
    fontSize: 25,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#444",
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    textAlign: "center",
    color: "#6b4b45",
    fontWeight: "600",
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    gap: 10,
  },
  codeInput: {
    backgroundColor: "#fff",
    width: 50,
    height: 60,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 2,
    borderColor: "#6b4b45",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: "#6b4b45",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    width: "80%",
  },
  verifyButtonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    color: "#444",
  },
  resendLink: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "700",
  },
  backContainer: {
    alignItems: "center",
    marginTop: 30,
  },
  backText: {
    fontSize: 14,
    color: "#6b4b45",
    fontWeight: "600",
  },
});