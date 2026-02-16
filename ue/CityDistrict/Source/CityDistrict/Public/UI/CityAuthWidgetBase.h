#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "CityAuthWidgetBase.generated.h"

class UEditableTextBox;
class UTextBlock;
class UButton;
class UCityApiSubsystem;

UCLASS(Abstract, Blueprintable)
class CITYDISTRICT_API UCityAuthWidgetBase : public UUserWidget
{
    GENERATED_BODY()

public:
    virtual void NativeConstruct() override;

protected:
    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UEditableTextBox> NicknameField;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UEditableTextBox> PasswordField;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UEditableTextBox> RefCodeField;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UButton> LoginButton;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UButton> RegisterButton;

    UPROPERTY(meta = (BindWidgetOptional), BlueprintReadOnly)
    TObjectPtr<UTextBlock> StatusText;

    UFUNCTION()
    void HandleLoginClicked();

    UFUNCTION()
    void HandleRegisterClicked();

    UFUNCTION()
    void HandleLoginFinished(bool bSuccess, const FString& ErrorMessage);

    UFUNCTION()
    void HandleRegisterFinished(bool bSuccess, const FString& ErrorMessage);

private:
    UCityApiSubsystem* GetApiSubsystem() const;
};
