#include "UI/CityAuthWidgetBase.h"

#include "Components/Button.h"
#include "Components/EditableTextBox.h"
#include "Components/TextBlock.h"
#include "Engine/GameInstance.h"
#include "Network/CityApiSubsystem.h"

void UCityAuthWidgetBase::NativeConstruct()
{
    Super::NativeConstruct();

    if (LoginButton)
    {
        LoginButton->OnClicked.AddDynamic(this, &UCityAuthWidgetBase::HandleLoginClicked);
    }

    if (RegisterButton)
    {
        RegisterButton->OnClicked.AddDynamic(this, &UCityAuthWidgetBase::HandleRegisterClicked);
    }

    if (UCityApiSubsystem* Api = GetApiSubsystem())
    {
        Api->OnLoginFinished.AddDynamic(this, &UCityAuthWidgetBase::HandleLoginFinished);
        Api->OnRegisterFinished.AddDynamic(this, &UCityAuthWidgetBase::HandleRegisterFinished);
    }
}

void UCityAuthWidgetBase::HandleLoginClicked()
{
    if (UCityApiSubsystem* Api = GetApiSubsystem())
    {
        Api->LoginUser(
            NicknameField ? NicknameField->GetText().ToString() : FString(),
            PasswordField ? PasswordField->GetText().ToString() : FString());
    }
}

void UCityAuthWidgetBase::HandleRegisterClicked()
{
    if (UCityApiSubsystem* Api = GetApiSubsystem())
    {
        Api->RegisterUser(
            NicknameField ? NicknameField->GetText().ToString() : FString(),
            PasswordField ? PasswordField->GetText().ToString() : FString(),
            RefCodeField ? RefCodeField->GetText().ToString() : FString());
    }
}

void UCityAuthWidgetBase::HandleLoginFinished(bool bSuccess, const FString& ErrorMessage)
{
    if (!StatusText)
    {
        return;
    }

    StatusText->SetText(FText::FromString(bSuccess ? TEXT("Вход выполнен") : FString::Printf(TEXT("Ошибка входа: %s"), *ErrorMessage)));
}

void UCityAuthWidgetBase::HandleRegisterFinished(bool bSuccess, const FString& ErrorMessage)
{
    if (!StatusText)
    {
        return;
    }

    StatusText->SetText(FText::FromString(bSuccess ? TEXT("Регистрация успешна") : FString::Printf(TEXT("Ошибка регистрации: %s"), *ErrorMessage)));
}

UCityApiSubsystem* UCityAuthWidgetBase::GetApiSubsystem() const
{
    return GetGameInstance() ? GetGameInstance()->GetSubsystem<UCityApiSubsystem>() : nullptr;
}
